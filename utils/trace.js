/**
 * 最终态 trace（task_event v2）纯数据层。
 *
 * 契约（task-16，服务端为准）：
 *   GET /api/v1/tasks/{id}?after_seq=N →
 *     { traceVersion:2, run:{taskId,status,startedAt,endedAt,summary,stepCount},
 *       lastSeq:N, events:[{seq,stepId,parentSeq,kind,phase,status,name,summary,
 *       inputPreview,outputPreview,outputRef,outputBytes,truncated,error,attempt,
 *       retryOfSeq,startedAt,endedAt,visibility,artifacts?}] }
 *   账本 append-only：开始=running 事件；完成/失败=新 seq、同 stepId 的事件
 *   （parentSeq 指回开始 seq）；按 stepId 取 seq 最大的事件为当前状态。
 *   重试另算（retryOfSeq/attempt>1）；失败步骤会出现在失败置顶块。
 *   历史消息：message.trace 仍是旧数组，v2 数据在 messages[].events + traceVersion=2。
 *
 * 这里只做纯函数：合并、去重、状态单向、拍平 3 层视图、裁剪/截断/格式化。
 * 不依赖 wx / DOM，方便 Node 单测；组件负责 setData 和交互。
 */
const { API_BASE } = require("./config");

const PHASES = ["understand", "plan", "gather", "act", "finish"];
const PHASE_LABEL = {
  understand: "理解",
  plan: "计划",
  gather: "取材",
  act: "执行",
  finish: "收口",
};

const STATUS = {
  pending: { label: "排队", tone: "idle", glyph: "○", rank: 0 },
  running: { label: "运行中", tone: "run", glyph: "●", rank: 1 },
  retrying: { label: "重试中", tone: "retry", glyph: "↻", rank: 2 },
  succeeded: { label: "成功", tone: "done", glyph: "✓", rank: 3, terminal: true },
  failed: { label: "失败", tone: "fail", glyph: "!", rank: 3, terminal: true },
  skipped: { label: "跳过", tone: "skip", glyph: "–", rank: 3, terminal: true },
  cancelled: { label: "已取消", tone: "skip", glyph: "–", rank: 3, terminal: true },
};

const RUN_STATUS = {
  queued: { label: "排队中", tone: "idle" },
  running: { label: "运行中", tone: "run" },
  done: { label: "已完成", tone: "done" },
  succeeded: { label: "已完成", tone: "done" },
  partial: { label: "部分完成", tone: "retry" },
  failed: { label: "失败", tone: "fail" },
  cancelled: { label: "已取消", tone: "skip" },
};

const KIND_LABEL = {
  plan: "计划",
  tool: "工具",
  file_read: "读文件",
  file_write: "写文件",
  image_read: "读图片",
  subagent: "子任务",
  artifact: "产物",
  validation: "校验",
  note: "备注",
  error: "错误",
  status: "状态",
};

const MAX_STEPS = 80;
const MAX_FAIL_ROWS = 5;
const MAX_OUTPUT_LINES = 6;
const MAX_OUTPUT_BYTES = 2048;
const MAX_INPUT_BYTES = 1024;
const MAX_ERROR_CHARS = 400;

function str(v) {
  return v == null ? "" : String(v);
}

/** 去掉控制字符、合并空白，但不改中文内容 */
function cleanText(v, max) {
  let s = str(v)
    .replace(/\r\n?/g, "\n")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "")
    .trim();
  if (max && s.length > max) s = s.slice(0, max) + "…";
  return s;
}

/** 首 N 行（不改内容） */
function firstLines(text, n) {
  const s = str(text).replace(/\r\n?/g, "\n");
  if (!s) return "";
  const lines = s.split("\n");
  return lines.slice(0, n || MAX_OUTPUT_LINES).join("\n");
}

/** 按字节裁切（中文按 UTF-8 估算；预览用，不追求精确） */
function clipBytes(text, maxBytes) {
  const s = str(text);
  if (!s) return { text: "", cut: false };
  if (maxBytes >= s.length * 3) return { text: s, cut: false };
  let acc = 0;
  let out = "";
  for (const ch of s) {
    const code = ch.codePointAt(0);
    const bytes = code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
    if (acc + bytes > maxBytes) return { text: out, cut: true };
    acc += bytes;
    out += ch;
  }
  return { text: out, cut: false };
}

function formatDuration(ms) {
  const n = Number(ms);
  if (!isFinite(n) || n < 0) return "";
  if (n < 1000) return Math.round(n) + "ms";
  if (n < 60 * 1000) return (n / 1000).toFixed(n < 10 * 1000 ? 1 : 0) + "秒";
  const m = Math.floor(n / 60000);
  const s = Math.round((n % 60000) / 1000);
  return m + "分" + (s ? s + "秒" : "");
}

function formatBytes(n) {
  const v = Number(n);
  if (!isFinite(v) || v <= 0) return "";
  if (v < 1024) return v + " B";
  if (v < 1024 * 1024) return (v / 1024).toFixed(v < 10 * 1024 ? 1 : 0) + " KB";
  return (v / (1024 * 1024)).toFixed(1) + " MB";
}

function toMs(v) {
  if (!v) return 0;
  if (typeof v === "number") return v;
  const t = Date.parse(String(v).replace(" ", "T"));
  return isFinite(t) ? t : 0;
}

function statusMeta(s) {
  return STATUS[s] || { label: cleanText(s) || "未知", tone: "idle", glyph: "?", rank: -1 };
}

function runMeta(s) {
  return RUN_STATUS[s] || RUN_STATUS.queued;
}

function phaseMeta(p) {
  const key = PHASES.indexOf(p) >= 0 ? p : "act";
  return { key: key, label: PHASE_LABEL[key] };
}

/** 图片/产物地址绝对化：短签是 /api/... 相对路径，<image> 需要 API_BASE 前缀 */
function absoluteUrl(u) {
  const s = str(u).trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  if (/^(data:|wxfile:|file:|\/\/)/i.test(s)) return "";
  if (s.charAt(0) === "/") return (API_BASE || "") + s;
  return "";
}

/** v2 事件列表：历史消息里 v2 数据在 messages[].events（message.trace 仍是旧数组） */
function v2EventsOf(m) {
  if (!m || typeof m !== "object") return null;
  if (Array.isArray(m.events) && m.events.length) return m.events;
  const t = m.trace;
  if (t && !Array.isArray(t) && typeof t === "object" && Array.isArray(t.events) && t.events.length) {
    return t.events;
  }
  if (Array.isArray(t) && t.length && t[0] && typeof t[0] === "object" && t[0].seq != null) {
    return t; // 兼容 trace 直接是 v2 事件数组的早期投影
  }
  return null;
}

/**
 * 是否有可渲染的 v2 数据（判据必须严格）：
 *   · 有非空 v2 事件（messages[].events / trace.events / trace=事件数组）；或
 *   · lastSeq>0（有账本但本次增量/投影没带 events，可由组件懒加载 /trace）。
 * run 有 stepCount/startedAt 不能单独作为 v2 判据：旧任务也有 run 投影，
 * 会导致旧 message.trace 被跳过而显示空 trace。
 * 反例：历史任务 traceVersion=2、events=[]、lastSeq=0、只有旧 message.trace
 *       → false，页面走旧扁平渲染，绝不显示空 trace。
 */
function isTraceV2(m) {
  if (!m || typeof m !== "object") return false;
  // 后端明确标记 v1（旧任务）时绝不能因为 run 载荷误判 v2。
  if (Number(m.traceVersion) === 1) return false;
  if (v2EventsOf(m)) return true;
  const t = m.trace;
  const tObj = t && !Array.isArray(t) && typeof t === "object" ? t : null;
  const lastSeq = Number(m.lastSeq || (tObj && tObj.lastSeq) || 0);
  if (lastSeq > 0) return true;
  return false;
}

/** 与 isTraceV2 同口径：页面用它决定“建 store / 走组件”还是“回退旧扁平 trace” */
function hasV2Data(m) {
  return isTraceV2(m);
}

/** 事件字段白名单化：只保留 UI 需要的字段，避免把 raw/CoT 带进 data */
function normalizeEvent(e) {
  if (!e || typeof e !== "object") return null;
  const seq = Number(e.seq);
  if (!isFinite(seq)) return null;
  const rawStepId = e.stepId != null ? e.stepId : e.step_id != null ? e.step_id : "";
  const hasStepId = String(rawStepId).trim() !== "";
  const stepId = cleanText(rawStepId, 40) || "s" + seq;
  const status = STATUS[e.status] ? e.status : "pending";
  const phase = PHASES.indexOf(e.phase) >= 0 ? e.phase : "act";
  let artifacts = [];
  if (Array.isArray(e.artifacts)) {
    artifacts = e.artifacts
      .filter((a) => a && typeof a === "object")
      .slice(0, 4)
      .map((a) => ({
        type: cleanText(a.type || "", 12),
        url: absoluteUrl(a.url),
        name: cleanText(a.name || a.title || "", 60),
        docId: a.docId != null ? a.docId : null,
        assetId: cleanText(a.assetId || "", 40),
        photoId: a.photoId != null ? a.photoId : null,
      }));
  } else if (e.outputRef) {
    const ref = String(e.outputRef);
    if (/^doc:\d+$/.test(ref)) artifacts = [{ type: "doc", docId: Number(ref.slice(4)), name: "文书 #" + ref.slice(4), url: "" }];
    else if (/^asset:[0-9A-HJKMNP-TV-Z]{26}$/.test(ref)) artifacts = [{ type: "asset", assetId: ref.slice(6), name: "产物", url: "" }];
    else if (/^photo:\d+$/.test(ref)) artifacts = [{ type: "photo", photoId: Number(ref.slice(6)), name: "现场照片 #" + ref.slice(6), url: "" }];
  }
  const startedAt = e.startedAt || e.started_at || null;
  const endedAt = e.endedAt || e.ended_at || null;
  return {
    seq: seq,
    stepId: stepId,
    hasStepId: hasStepId,
    parentSeq: e.parentSeq == null ? null : Number(e.parentSeq),
    kind: cleanText(e.kind || "status", 16),
    phase: phase,
    status: status,
    name: cleanText(e.name || KIND_LABEL[e.kind] || "步骤", 60),
    summary: cleanText(e.summary || "", 160),
    inputPreview: cleanText(e.inputPreview != null ? e.inputPreview : e.input_preview, 4000),
    outputPreview: cleanText(e.outputPreview != null ? e.outputPreview : e.output_preview, 8000),
    outputRef: cleanText(e.outputRef != null ? e.outputRef : e.output_ref, 120),
    outputBytes: Number(e.outputBytes != null ? e.outputBytes : e.output_bytes) || 0,
    truncated: !!e.truncated,
    error: cleanText(e.error != null ? e.error : e.error_detail, MAX_ERROR_CHARS),
    attempt: Number(e.attempt) || 1,
    retryOfSeq: e.retryOfSeq == null ? null : Number(e.retryOfSeq),
    startedAt: startedAt,
    endedAt: endedAt,
    startsMs: toMs(startedAt),
    endsMs: toMs(endedAt),
    visibility: cleanText(e.visibility || "project", 12),
    artifacts: artifacts,
  };
}

function createStore() {
  return { traceVersion: 2, events: [], lastSeq: 0, run: null, _keys: Object.create(null), _idx: Object.create(null) };
}

/** 历史 message 里可能带的 v2 投影，尽量宽容地拆成 {events,run,lastSeq,traceVersion} */
function extractTracePayload(m) {
  if (!m || typeof m !== "object") return null;
  const t = m.trace;
  const tObj = t && !Array.isArray(t) && typeof t === "object" ? t : null;
  let events = v2EventsOf(m);
  if (!events && Array.isArray(t) && t.length && t[0] && typeof t[0] === "object" && t[0].seq != null) {
    events = t; // 兼容 trace 直接是 v2 事件数组的早期投影
  }
  const payload = {
    events: events || [],
    run: (tObj && tObj.run) || m.traceRun || m.run || null,
    lastSeq: Number((tObj && tObj.lastSeq) || m.lastSeq || 0) || 0,
    traceVersion: Number((tObj && tObj.traceVersion) || m.traceVersion || 2) || 2,
  };
  // traceVersion=2 但没有任何 v2 数据（历史任务只有旧 message.trace）→ 不建空 store
  if (!payload.events.length && !payload.lastSeq && !payload.run) return null;
  const store = createStore();
  mergeInto(store, payload);
  return store;
}

/**
 * 增量合并：按 (seq,stepId) 去重 upsert；状态只前进；终态不再被回写。
 * 返回 { added, updated, lastSeq }。
 */
function mergeInto(store, payload) {
  if (!store || !payload) return { added: 0, updated: 0, lastSeq: store ? store.lastSeq : 0 };
  store._keys = store._keys || Object.create(null);
  store._idx = store._idx || Object.create(null);
  if (Number(payload.traceVersion) >= 2) store.traceVersion = 2;
  const incoming = Array.isArray(payload.events) ? payload.events : [];
  let added = 0;
  let updated = 0;

  incoming.forEach((raw) => {
    const e = normalizeEvent(raw);
    if (!e) return;
    const key = e.seq + "|" + e.stepId;
    const old = store._keys[key];
    if (old) {
      const oldMeta = statusMeta(old.status);
      const newMeta = statusMeta(e.status);
      let merged = Object.assign({}, old);
      // 状态单向：只允许前进；旧终态任何情况下都不退回
      if (!oldMeta.terminal && newMeta.rank >= oldMeta.rank) merged.status = e.status;
      merged = mergeDetail(merged, e);
      merged.seq = old.seq;
      merged.stepId = old.stepId;
      store._keys[key] = merged;
      const oi = store._idx[key];
      if (oi != null && store.events[oi]) store.events[oi] = merged;
      updated += 1;
      return;
    }
    // seq 唯一但 stepId 不一致：服务端不应出现，忽略冲突项
    const dupSeq = store.events.filter((x) => x.seq === e.seq)[0];
    if (dupSeq) {
      if (dupSeq.stepId === e.stepId) {
        store._keys[key] = mergeDetail(dupSeq, e);
        updated += 1;
      }
      return;
    }
    store.events.push(e);
    store._keys[key] = e;
    store._idx[key] = store.events.length - 1;
    added += 1;
  });

  if (added) store.events.sort((a, b) => a.seq - b.seq);
  const maxSeq = store.events.length ? store.events[store.events.length - 1].seq : 0;
  store.lastSeq = Math.max(store.lastSeq || 0, Number(payload.lastSeq) || 0, maxSeq);

  if (payload.run) {
    const prev = store.run || {};
    const incomingRun = Object.assign({}, payload.run);
    const terminalPrev =
      prev.status === "succeeded" || prev.status === "failed" ||
      prev.status === "cancelled" || prev.status === "partial" || prev.status === "done";
    if (terminalPrev && incomingRun.status && incomingRun.status !== prev.status) {
      incomingRun.status = prev.status; // 终态不回退
    } else if (prev.status && incomingRun.status && runRank(incomingRun) < runRank(prev)) {
      incomingRun.status = prev.status;
    }
    store.run = Object.assign({}, prev, incomingRun);
  }
  return { added: added, updated: updated, lastSeq: store.lastSeq };
}

function runRank(r) {
  return { queued: 0, running: 1, partial: 2, succeeded: 3, done: 3, failed: 3, cancelled: 3 }[(r || {}).status] || 0;
}

function mergeDetail(old, incoming) {
  const out = Object.assign({}, old);
  Object.keys(incoming).forEach((k) => {
    const v = incoming[k];
    if (k === "status" || k === "seq" || k === "stepId") return;
    if (Array.isArray(v)) {
      if (v.length && (!Array.isArray(out[k]) || !out[k].length)) out[k] = v;
      return;
    }
    if (v === "" || v == null) return;
    if (typeof v === "number" && (!isFinite(v) || v === 0) && out[k]) return;
    if (typeof v === "string" && out[k] && String(out[k]).length > v.length && out[k] !== v) return;
    out[k] = v;
  });
  return out;
}

function eventDuration(e, now) {
  const start = e.startsMs || 0;
  const end = e.endsMs || 0;
  if (start && end && end >= start) return formatDuration(end - start);
  if (start && statusMeta(e.status).rank <= 2) return formatDuration((now || Date.now()) - start);
  return "";
}

function eventView(e, open, ctx, agg) {
  const meta = statusMeta(e.status);
  const phase = phaseMeta(e.phase);
  const outAll = e.outputPreview || "";
  const clippedOut = clipBytes(outAll, MAX_OUTPUT_BYTES);
  const linesOut = firstLines(clippedOut.text, MAX_OUTPUT_LINES);
  const locallyCut = clippedOut.cut || outAll.split("\n").length > MAX_OUTPUT_LINES;
  const clippedIn = clipBytes(e.inputPreview || "", MAX_INPUT_BYTES);
  const truncated = !!(e.truncated || locallyCut);
  const size = formatBytes(e.outputBytes) || formatBytes(outAll.length ? Math.max(outAll.length, 0) * 3 : 0);
  const dur = eventDuration(e, ctx.now);
  // 同一 step 的开始/完成可能是两条事件（新 seq 同 stepId），不算重试；
  // 重试以 attempt>1 / retryOfSeq 为准。
  const maxAttempt = agg && agg.maxAttempt ? agg.maxAttempt : Number(e.attempt) || 1;
  const retryText = maxAttempt > 1 ? "第 " + maxAttempt + " 次" : "";
  // 重试后成功的步骤：保留上次失败信息，别把失败悄悄吞掉
  const lastFailed = agg && agg.lastFailed ? agg.lastFailed : null;
  const hadFailure = !!lastFailed && e.status !== "failed";
  const failureText = hadFailure
    ? cleanText((lastFailed.error || lastFailed.summary || "").slice(0, 300), 300)
    : "";
  let name = e.name || KIND_LABEL[e.kind] || "步骤";
  // 子智能体只显示一行摘要，不下钻它的完整 trace
  if (e.kind === "subagent" && e.summary && name.indexOf(e.summary) < 0) {
    name = (name + " · " + e.summary).slice(0, 60);
  }
  return {
    stepId: e.stepId,
    seq: e.seq,
    name: name,
    kindLabel: KIND_LABEL[e.kind] || "",
    phase: phase.key,
    phaseLabel: phase.label,
    status: e.status,
    statusLabel: meta.label,
    statusTone: meta.tone,
    statusGlyph: meta.glyph,
    durText: dur,
    retryText: retryText,
    retried: !!retryText,
    hadFailure: hadFailure,
    failureText: failureText,
    summary: e.summary || "",
    open: !!open,
    inputText: clippedIn.text,
    inputMore: clippedIn.cut,
    outputText: linesOut,
    outputMore: locallyCut,
    truncated: truncated,
    sizeText: truncated ? size : "",
    errorText: e.error || "",
    artifacts: (e.artifacts || []).map(function (a) {
      return {
        type: a.type,
        url: a.url,
        name: a.name,
        docId: a.docId,
        assetId: a.assetId,
        photoId: a.photoId,
      };
    }),
    aria:
      name + "，" + meta.label +
      (dur ? "，耗时 " + dur : "") +
      (retryText ? "，" + retryText : "") +
      (hadFailure ? "，曾有失败" : ""),
  };
}

function stepReps(events) {
  // 1) run 级 kind=status 只服务 L1，不进 L2：否则 845 会 4 步变 6 行、
  //    844 的 133 步与 80+more 对不上。
  // 2) 子智能体（kind=subagent）parentSeq 语义是「父 step」，不是嵌套：
  //    必须作为一行独立摘要显示；子 agent 内部事件（parent 不同 stepId）才隐藏。
  // 3) stepId=null 的单发事件用 "s"+seq 兜底；同 stepId 的 append-only 完成事件合并。
  const bySeq = Object.create(null);
  events.forEach((e) => { bySeq[e.seq] = e; });
  const roots = events.filter((e) => {
    if (e.kind === "status") return false;
    if (e.visibility === "private" || e.visibility === "admin") return false;
    if (e.kind === "subagent") return true; // 子智能体总是独立一行
    if (e.parentSeq == null) return true;
    const parent = bySeq[e.parentSeq];
    if (!parent) return true; // 父事件被裁掉时，子事件当根处理，避免信息丢失
    // append-only 完成事件：新 seq、同 stepId、parentSeq 指回开始 seq → 同一 step 的续条
    if (parent.stepId === e.stepId) return true;
    return false; // 真嵌套（子智能体内部）不渲染
  });
  const map = Object.create(null);
  roots.forEach((e) => {
    // 子智能体没有 stepId 时按 parentSeq 归并（派发/回报两条 → 一行）
    const key = e.kind === "subagent" && !e.hasStepId
      ? "sub@" + (e.parentSeq != null ? e.parentSeq : "r")
      : e.stepId;
    let m = map[key];
    if (!m) {
      m = map[key] = {
        latest: e,
        firstSeq: e.seq,
        eventCount: 1,
        maxAttempt: Number(e.attempt) || 1,
        retries: e.retryOfSeq != null ? 1 : 0,
        lastFailed: e.status === "failed" ? e : null,
        subagent: e.kind === "subagent",
        summary: e.summary || "",
      };
    } else {
      m.eventCount += 1;
      if (e.seq > m.latest.seq) m.latest = e;
      const att = Number(e.attempt) || 1;
      if (att > m.maxAttempt) m.maxAttempt = att;
      if (e.retryOfSeq != null) m.retries += 1;
      if (e.status === "failed" && (!m.lastFailed || e.seq > m.lastFailed.seq)) m.lastFailed = e;
      if ((e.summary || "").length > (m.summary || "").length) m.summary = e.summary;
    }
    if (m.subagent) {
      // 一行摘要：stepId 稳定为分组 key，summary 取组内最长（派发/回报都算）
      m.latest = Object.assign({}, m.latest, {
        stepId: key,
        hasStepId: true,
        summary: m.summary || m.latest.summary || "",
      });
    }
  });
  return Object.keys(map).map(function (k) { return map[k]; });
}

/**
 * 拍平三层视图：L1 run、L2 阶段/步骤、L3 详情由 open 控制。
 * ui: { openRun, touched:{stepId:bool} }
 */
function buildView(store, ui, ctx) {
  const c = ctx || {};
  const now = c.now || Date.now();
  const u = ui || {};
  const touched = u.touched || {};
  const reps = store && store.events ? stepReps(store.events) : [];
  const allSteps = reps.map(function (r) {
    return {
      e: r.latest, maxAttempt: r.maxAttempt, retries: r.retries, lastFailed: r.lastFailed,
    };
  });
  allSteps.sort((a, b) => a.e.seq - b.e.seq);

  const failedSteps = allSteps.filter((x) => x.e.status === "failed");
  // run 先算：只有 run 还在跑才自动展开「当前步」；已结束的 turn 里残留 running 起始事件
  // 不应把完成态误展示成进行中（真实样例 task 845 就有 succeeded + 2 条 running 起始）。
  const run = buildRun(store, allSteps, failedSteps.length, now);
  const active = allSteps
    .filter((x) => x.e.status === "running" || x.e.status === "retrying")
    .sort((a, b) => b.e.seq - a.e.seq)[0] || null;
  const activeStepId = run.running && active ? active.e.stepId : "";

  // 80 节点上限：失败/进行中优先，且每个阶段至少保留最早一步（长任务别把 5 阶段裁成 2 段）
  let shown = allSteps;
  let moreCount = 0;
  if (allSteps.length > MAX_STEPS) {
    const priority = allSteps.filter(
      (x) => x.e.status === "failed" || x.e.stepId === activeStepId
    );
    const phaseFirst = [];
    PHASES.forEach(function (k) {
      const first = allSteps.filter((x) => phaseMeta(x.e.phase).key === k)[0];
      if (first && priority.indexOf(first) < 0) phaseFirst.push(first);
    });
    const keep = priority.concat(phaseFirst);
    const rest = allSteps.filter((x) => keep.indexOf(x) < 0);
    const keepRest = Math.max(0, MAX_STEPS - keep.length);
    const picked = keep.concat(rest.slice(-keepRest));
    shown = picked.sort((a, b) => a.e.seq - b.e.seq);
    moreCount = allSteps.length - shown.length;
  }

  const failViews = failedSteps.slice(0, MAX_FAIL_ROWS).map(function (x) {
    const v = eventView(x.e, true, { now: now }, x);
    v.attempts = x.maxAttempt;
    return v;
  });
  const failMore = Math.max(0, failedSteps.length - failViews.length);

  // 失败置顶：阶段列里不再重复失败步骤；进行中自动展开，其余按用户意图
  const phases = [];
  const phaseMap = Object.create(null);
  shown.forEach(function (x) {
    if (x.e.status === "failed") return;
    const p = phaseMeta(x.e.phase);
    if (!phaseMap[p.key]) {
      phaseMap[p.key] = { key: p.key, label: p.label, steps: [] };
    }
    const stepId = x.e.stepId;
    let open;
    if (touched[stepId] !== undefined) open = !!touched[stepId];
    else open = stepId === activeStepId;
    const v = eventView(x.e, open, { now: now }, x);
    v.attempts = x.maxAttempt;
    phaseMap[p.key].steps.push(v);
  });
  PHASES.forEach(function (key) {
    if (phaseMap[key] && phaseMap[key].steps.length) phases.push(phaseMap[key]);
  });
  // 失败步骤的详情打开态同样尊重用户手动收起
  failViews.forEach(function (v) {
    if (touched[v.stepId] !== undefined) v.open = !!touched[v.stepId];
    else v.open = true; // 失败强制展开
  });

  return {
    ready: !!(reps.length || (store && store.run)),
    run: run,
    openRun: !!u.openRun,
    phases: phases,
    failures: failViews,
    failureMore: failMore,
    moreCount: moreCount,
    activeStepId: activeStepId,
    totalSteps: allSteps.length,
  };
}

function inferRunStatus(reps, failedCount) {
  if (!reps.length) return "queued";
  if (reps.some((r) => r.e.status === "running" || r.e.status === "retrying")) return "running";
  if (failedCount) return "failed";
  if (reps.every((r) => statusMeta(r.e.status).terminal)) return "succeeded";
  return "running";
}

function buildRun(store, reps, failedCount, now) {
  const r = (store && store.run) || {};
  const status = r.status || inferRunStatus(reps, failedCount);
  const rm = runMeta(status);
  const all = store && store.events
    ? stepReps(store.events).map(function (r2) {
        return { e: r2.latest, maxAttempt: r2.maxAttempt, retries: r2.retries };
      })
    : reps;
  const stepCount = Number(r.stepCount != null ? r.stepCount : all.length) || all.length;
  const toolCount = all.filter(function (x) {
    return x.e.kind === "tool" || x.e.kind === "file_read" ||
      x.e.kind === "file_write" || x.e.kind === "image_read";
  }).length;
  const active = reps
    .filter((x) => x.e.status === "running" || x.e.status === "retrying")
    .sort((a, b) => b.e.seq - a.e.seq)[0] || null;
  const start = toMs(r.startedAt);
  const end = toMs(r.endedAt);
  let elapsed = "";
  if (start) elapsed = formatDuration((end && end >= start ? end : now) - start);
  else if (all.length) {
    const first = all.reduce((a, b) => (a.e.seq < b.e.seq ? a : b));
    const last = all.reduce((a, b) => (a.e.seq > b.e.seq ? a : b));
    const s = first.e.startsMs || first.e.endsMs;
    if (s) elapsed = formatDuration((last.e.endsMs || (status === "running" ? now : s)) - s);
  }
  const summary =
    cleanText(r.summary, 160) ||
    (active ? "正在" + active.e.name : "") ||
    (reps.length ? reps[reps.length - 1].e.name : "");
  const meta = [];
  if (stepCount) meta.push(stepCount + " 步");
  if (toolCount) meta.push(toolCount + " 次工具");
  if (elapsed) meta.push(elapsed);
  return {
    taskId: r.taskId != null ? r.taskId : null,
    status: status,
    title: rm.label,
    tone: rm.tone,
    metaText: meta.join(" · "),
    summary: summary,
    currentStep: active ? active.e.name : "",
    currentStatus: active ? statusMeta(active.e.status).label : "",
    stepCount: stepCount,
    toolCount: toolCount,
    elapsedText: elapsed,
    running: status === "running" || status === "queued",
  };
}

/** 详情弹层：兼容 {output|text|content, artifacts|images, truncated} */
function normalizeDetail(payload) {
  const d = payload && payload.data ? payload.data : payload || {};
  const output = cleanText(
    d.output != null ? d.output : d.text != null ? d.text : d.content != null ? d.content : "",
    20000
  );
  const artifacts = [];
  const lists = [d.artifacts, d.assets, d.images, d.files];
  lists.forEach(function (list) {
    if (!Array.isArray(list)) return;
    list.forEach(function (a) {
      if (!a || typeof a !== "object") return;
      artifacts.push({
        type: cleanText(a.type || (a.url && /\.(png|jpe?g|webp)$/i.test(a.url) ? "image" : ""), 12),
        url: absoluteUrl(a.url),
        name: cleanText(a.name || a.title || "", 60),
        docId: a.docId != null ? a.docId : null,
        assetId: cleanText(a.assetId || "", 40),
        photoId: a.photoId != null ? a.photoId : null,
      });
    });
  });
  return {
    output: output,
    truncated: !!d.truncated,
    artifacts: artifacts.slice(0, 8),
  };
}

module.exports = {
  PHASES: PHASES,
  PHASE_LABEL: PHASE_LABEL,
  MAX_STEPS: MAX_STEPS,
  MAX_FAIL_ROWS: MAX_FAIL_ROWS,
  MAX_OUTPUT_LINES: MAX_OUTPUT_LINES,
  MAX_OUTPUT_BYTES: MAX_OUTPUT_BYTES,
  STATUS: STATUS,
  createStore: createStore,
  normalizeEvent: normalizeEvent,
  isTraceV2: isTraceV2,
  hasV2Data: hasV2Data,
  extractTracePayload: extractTracePayload,
  mergeInto: mergeInto,
  buildView: buildView,
  normalizeDetail: normalizeDetail,
  statusMeta: statusMeta,
  runMeta: runMeta,
  phaseMeta: phaseMeta,
  formatDuration: formatDuration,
  formatBytes: formatBytes,
  firstLines: firstLines,
  cleanText: cleanText,
  clipBytes: clipBytes,
};

/**
 * 最终态 trace 组件：L1 轮次 / L2 阶段步骤 / L3 单步详情。
 *
 * 页面对接方式（不把 events 塞进 data）：
 *   · 首次挂载后 page 调 loadStore(store)
 *   · 轮询增量后 page 调 applyStore(store)（store 是 utils/trace 的纯 JS 对象）
 *   · 展开/收起、详情懒加载、状态 diff setData 全在组件内部
 */
const trace = require("../../utils/trace");
const api = require("../../utils/request");

const STEP_DIFF_FIELDS = [
  "status", "statusLabel", "statusTone", "statusGlyph", "durText", "retryText",
  "retried", "hadFailure", "failureText", "name", "kindLabel", "phaseLabel",
  "open", "inputText", "outputText", "truncated", "sizeText", "errorText",
  "summary", "seq", "aria", "artifacts",
];

function samePhaseStruct(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].key !== b[i].key || a[i].steps.length !== b[i].steps.length) return false;
    for (let j = 0; j < a[i].steps.length; j++) {
      if (a[i].steps[j].stepId !== b[i].steps[j].stepId) return false;
    }
  }
  return true;
}

Component({
  options: { styleIsolation: "isolated" },

  properties: {
    messageId: { type: String, value: "" },
    taskId: { type: String, value: "" },
    pending: {
      type: Boolean,
      value: false,
      observer() {
        if (this._store) this._render();
      },
    },
  },

  data: {
    ready: false,
    run: { title: "准备中", tone: "idle", metaText: "", summary: "", currentStep: "", currentStatus: "", running: false },
    openRun: false,
    phases: [],
    failures: [],
    failureMore: 0,
    moreCount: 0,
    detailOpen: false,
    detailTitle: "",
    detailText: "",
    detailLoading: false,
  },

  lifetimes: {
    attached() {
      this._store = trace.createStore();
      // 展开态按 stepId 存实例 Map，不进 data；用户动过就记 touched，自动展开不再抢
      this._ui = { openRun: false, touched: Object.create(null) };
      this._view = null;
      this._detailCache = Object.create(null);
      this._artFetching = Object.create(null);
      this._fetchingTrace = false;
      this._ticker = null;
    },
    detached() {
      this._stopTicker();
      this._store = null;
      this._view = null;
    },
  },

  methods: {
    noop() {},

    /** 页面在组件挂载后注入纯 JS store（不进 data） */
    loadStore(store) {
      if (!store) return;
      this._store = store;
      this._render();
    },

    /** 轮询增量后页面调用；store 已被 page 合并好 */
    applyStore(store) {
      if (!store) return;
      this._store = store;
      this._render();
    },

    _render() {
      if (!this._store) return;
      const view = trace.buildView(this._store, this._ui, {
        now: Date.now(),
        pending: !!this.data.pending,
      });
      this._applyView(view);
      this._toggleTicker(view.run.running);
    },

    /** 单路径 setData：结构不变时只改变化的 step 字段，避免整段 trace 重渲染 */
    _applyView(view) {
      const patch = {};
      if (!this.data.ready) patch.ready = true;
      if (JSON.stringify(this.data.run) !== JSON.stringify(view.run)) patch.run = view.run;
      if (this.data.openRun !== view.openRun) patch.openRun = view.openRun;
      if (this.data.moreCount !== view.moreCount) patch.moreCount = view.moreCount;
      if (this.data.failureMore !== view.failureMore) patch.failureMore = view.failureMore;

      const prev = this._view;
      if (!prev || !samePhaseStruct(prev.phases, view.phases)) {
        patch.phases = view.phases;
      } else {
        view.phases.forEach((ph, pi) => {
          ph.steps.forEach((st, si) => {
            const old = prev.phases[pi].steps[si];
            STEP_DIFF_FIELDS.forEach((f) => {
              if (JSON.stringify(old[f]) !== JSON.stringify(st[f])) {
                patch["phases[" + pi + "].steps[" + si + "]." + f] = st[f];
              }
            });
          });
        });
      }
      if (JSON.stringify(prev ? prev.failures : null) !== JSON.stringify(view.failures)) {
        patch.failures = view.failures;
      }
      if (Object.keys(patch).length) this.setData(patch);
      this._view = view;
    },

    _findStep(stepId) {
      const v = this._view;
      if (!v) return null;
      const lists = [{ steps: v.failures, failed: true }].concat(
        v.phases.map((p) => ({ steps: p.steps, failed: false }))
      );
      for (let li = 0; li < lists.length; li++) {
        const steps = lists[li].steps;
        for (let s = 0; s < steps.length; s++) {
          if (steps[s].stepId === stepId) {
            return { step: steps[s], index: s, failed: lists[li].failed, listIndex: li - 1 };
          }
        }
      }
      return null;
    },

    _stepOpen(stepId) {
      const found = this._findStep(stepId);
      return !!(found && found.step.open);
    },

    // ---------------- L1 ----------------
    onToggleRun() {
      this._ui.openRun = !this._ui.openRun;
      if (this._ui.openRun) this._ensureHistory();
      this._render();
    },

    /** 历史消息只有 v2 标记、没带 events 时，第一次展开才拉全量（懒加载） */
    _ensureHistory() {
      if (!this.data.taskId) return;
      if (this._store && this._store.events.length) return;
      if (this._fetchingTrace) return;
      this._fetchingTrace = true;
      api
        .get("/api/v1/tasks/" + this.data.taskId + "/trace")
        .then((d) => {
          this._fetchingTrace = false;
          if (!d) return;
          trace.mergeInto(this._store, {
            traceVersion: d.traceVersion || 2,
            events: d.events || [],
            run: d.run || null,
            lastSeq: d.lastSeq || 0,
          });
          this._render();
        })
        .catch(() => {
          this._fetchingTrace = false;
        });
    },

    // ---------------- L2 / L3 ----------------
    onToggleStep(e) {
      const stepId = e && e.currentTarget && e.currentTarget.dataset.step;
      if (!stepId) return;
      const open = !this._stepOpen(stepId);
      this._ui.touched[stepId] = open; // 用户意图：之后自动展开不再抢
      this._render();
      if (open) this._ensureArtifacts(stepId);
    },

    onLoadDetail(e) {
      const seq = Number(e && e.currentTarget && e.currentTarget.dataset.seq);
      if (!seq) return;
      this._openDetail(seq);
    },

    _fetchDetail(seq) {
      if (this._detailCache[seq]) return Promise.resolve(this._detailCache[seq]);
      if (!this.data.taskId) return Promise.resolve(null);
      return api
        .get("/api/v1/tasks/" + this.data.taskId + "/events/" + seq + "/detail")
        .then((d) => {
          const n = trace.normalizeDetail(d);
          n.seq = seq;
          this._detailCache[seq] = n;
          return n;
        })
        .catch(() => null);
    },

    _openDetail(seq) {
      const cached = this._detailCache[seq];
      if (cached) {
        this._showDetail(cached);
        return;
      }
      this.setData({ detailOpen: true, detailLoading: true, detailTitle: "完整输出", detailText: "" });
      this._fetchDetail(seq).then((n) => {
        if (!n) {
          this.setData({ detailLoading: false, detailText: "详情加载失败，稍后重试" });
          return;
        }
        this._showDetail(n);
      });
    },

    _showDetail(n) {
      this.setData({
        detailOpen: true,
        detailLoading: false,
        detailTitle: n.truncated ? "完整输出 · 已脱敏" : "输出详情",
        detailText: n.output || "（没有更多内容）",
      });
      if (n.artifacts && n.artifacts.length) this._patchArtifacts(n.seq, n.artifacts);
    },

    /** L3 展开时产物没有 url 的，懒加载详情补缩略图（不打开弹层） */
    _ensureArtifacts(stepId) {
      const found = this._findStep(stepId);
      if (!found) return;
      const arts = found.step.artifacts || [];
      if (!arts.length) return;
      if (arts.some((a) => a.url)) return;
      if (this._artFetching[stepId]) return;
      this._artFetching[stepId] = true;
      this._fetchDetail(found.step.seq).then((n) => {
        this._artFetching[stepId] = false;
        if (n && n.artifacts && n.artifacts.length) this._patchArtifacts(n.seq, n.artifacts);
      });
    },

    _patchArtifacts(seq, artifacts) {
      const v = this._view;
      if (!v) return;
      const patch = {};
      v.phases.forEach((ph, pi) => {
        ph.steps.forEach((st, si) => {
          if (st.seq !== seq) return;
          const merged = mergeArtifacts(st.artifacts || [], artifacts);
          patch["phases[" + pi + "].steps[" + si + "].artifacts"] = merged;
          st.artifacts = merged;
        });
      });
      v.failures.forEach((st, fi) => {
        if (st.seq !== seq) return;
        const merged = mergeArtifacts(st.artifacts || [], artifacts);
        patch["failures[" + fi + "].artifacts"] = merged;
        st.artifacts = merged;
      });
      if (Object.keys(patch).length) this.setData(patch);
    },

    onArtifact(e) {
      const ds = e.currentTarget.dataset || {};
      if (ds.docid) {
        wx.navigateTo({ url: "/pages/draft/draft?id=" + encodeURIComponent(ds.docid) });
        return;
      }
      if (ds.url) {
        wx.previewImage({ current: ds.url, urls: [ds.url] });
        return;
      }
      wx.showToast({ title: "产物暂不可预览", icon: "none" });
    },

    onCloseDetail() {
      this.setData({ detailOpen: false, detailLoading: false });
    },

    onCopyDetail() {
      const text = this.data.detailText || "";
      if (!text) return;
      wx.setClipboardData({
        data: text,
        success: () => wx.showToast({ title: "已复制", icon: "none" }),
      });
    },

    onModalTap() {
      // 挡住遮罩点击
    },

    // ---------------- 运行中耗时 ----------------
    _toggleTicker(running) {
      if (running && !this._ticker) {
        this._ticker = setInterval(() => this._render(), 1000);
      } else if (!running && this._ticker) {
        this._stopTicker();
      }
    },
    _stopTicker() {
      if (this._ticker) {
        clearInterval(this._ticker);
        this._ticker = null;
      }
    },
  },
});

function mergeArtifacts(oldList, incoming) {
  const out = [];
  const seen = Object.create(null);
  (oldList || []).concat(incoming || []).forEach((a) => {
    const key = (a.type || "") + "|" + (a.url || "") + "|" + (a.docId != null ? a.docId : "") + "|" + (a.assetId || "") + "|" + (a.name || "");
    if (seen[key]) return;
    seen[key] = 1;
    out.push(a);
  });
  return out.slice(0, 6);
}

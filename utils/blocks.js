/**
 * answer.blocks 解析：把后端多模态回答里的资产块变成聊天卡片视图模型。
 *
 * 约定（与 jl-service answer.blocks v1 对齐）：
 *   blocks: [{ type: "text" | "image_ref" | "file_ref" | "card",
 *              assetId?, caption?, origin?, sourceRefs?, url?, name?, mime?,
 *              docId?, data?, actions? }]
 *
 * 设计原则：
 *   · 纯函数、不碰 wx / DOM，方便 Node 单测；只依赖 config.API_BASE 做绝对化
 *   · 未知 type、缺字段、坏 URL 一律不抛错：能显示就显示，不能显示回退文字
 *   · 一条消息最多一个主卡（图片 > 文件 > 卡片），其它类型最多 2 行 compact
 *   · 派生 / 示意不给作证、转发动作；文件只在证据态允许“转发菜单”
 */
const { API_BASE } = require("./config");

/** origin → 角标三态；缺 origin 用中性「附件」，不冒充证据 */
function originMeta(origin) {
  const o = String(origin || "").trim().toLowerCase();
  if (o === "uploaded") return { key: "uploaded", label: "证据", tone: "evidence", allowEvidence: true };
  if (o === "derived") return { key: "derived", label: "派生", tone: "derived", allowEvidence: false };
  if (o === "generated") return { key: "generated", label: "示意", tone: "generated", allowEvidence: false };
  return { key: "unknown", label: "附件", tone: "neutral", allowEvidence: false };
}

/** 只允许小程序 page 路径，拒绝外链 / 协议 / 其他项目路径 */
const PAGE_WHITELIST = [
  "/pages/draft/draft",
  "/pages/files/files",
  "/pages/project/project",
  "/pages/report/report",
  "/pages/capture/capture",
  "/pages/webview/webview",
];

const SHORT_PAGES = {
  draft: "/pages/draft/draft",
  files: "/pages/files/files",
  project: "/pages/project/project",
  report: "/pages/report/report",
  capture: "/pages/capture/capture",
  webview: "/pages/webview/webview",
};

/** openDocument 认识的类型；其它类型不传，交给微信按扩展名判断 */
const OPEN_FILE_TYPES = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx"];

const MIME_FILE_TYPE = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
};

const MAX_TITLE = 60;
const MAX_SOURCE = 20;

function cleanText(v, max) {
  const s = String(v == null ? "" : v)
    .replace(/\s+/g, " ")
    .trim();
  if (!s) return "";
  const n = max || MAX_TITLE;
  return s.length > n ? s.slice(0, n) + "…" : s;
}

/**
 * 图片 / 文件地址绝对化：
 *   · http(s) 原样（后端短签 URL）
 *   · 以 / 开头的站内路径补 API_BASE，<image> 才能加载
 *   · base64 / 本地路径 / 协议相对地址一律拒绝（模型不能输出这些）
 */
function absoluteUrl(u) {
  const s = String(u || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  if (/^(data:|wxfile:|file:|\/\/)/i.test(s)) return "";
  if (s.charAt(0) === "/") return (API_BASE || "") + s;
  return "";
}

/** sourceRefs → 一行来源：现场照片 #12 · 本项目 · 文书 #3；外链与未知长串不展示 */
function sourceText(refs, projectName) {
  const list = Array.isArray(refs) ? refs : refs ? [refs] : [];
  const out = [];
  list.forEach((r) => {
    const s = String(r == null ? "" : r).trim();
    if (!s) return;
    if (s.indexOf("photo:") === 0) {
      const id = s.slice(6);
      out.push("现场照片" + (id ? " #" + id : ""));
    } else if (s.indexOf("doc:") === 0) {
      const id = s.slice(4);
      out.push("文书" + (id ? " #" + id : ""));
    } else if (s.indexOf("project:") === 0) {
      out.push(cleanText(projectName, MAX_SOURCE) || "本项目");
    } else if (/^https?:\/\//i.test(s)) {
      return; // 外链不作为来源展示
    } else {
      out.push(cleanText(s, MAX_SOURCE));
    }
  });
  return out.slice(0, 2).join(" · ");
}

/** file_ref → openDocument(fileType)；认不出就不传，让微信自己判断 */
function fileTypeOf(block) {
  const b = block || {};
  const mime = String(b.mime || "").toLowerCase().split(";")[0].trim();
  if (MIME_FILE_TYPE[mime]) return MIME_FILE_TYPE[mime];
  const name = String(b.name || b.caption || "");
  const m = /\.([a-z0-9]{2,5})$/i.exec(name);
  if (m) {
    const ext = m[1].toLowerCase();
    if (OPEN_FILE_TYPES.indexOf(ext) >= 0) return ext;
  }
  return "";
}

function queryString(params) {
  if (!params || typeof params !== "object") return "";
  return Object.keys(params)
    .filter((k) => params[k] != null && params[k] !== "")
    .map((k) => encodeURIComponent(k) + "=" + encodeURIComponent(String(params[k])))
    .join("&");
}

/** 校验 page 路径：只认白名单页面，query 保留；外链/其他路径返回 "" */
function safeRoute(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s) || s.indexOf("//") === 0) return "";
  if (/^(javascript|wxfile|file|data):/i.test(s)) return "";
  const qi = s.indexOf("?");
  const path = qi >= 0 ? s.slice(0, qi) : s;
  const query = qi >= 0 ? s.slice(qi) : "";
  if (PAGE_WHITELIST.indexOf(path) < 0) return "";
  return path + query;
}

/**
 * card → 只读深链。兼容三种写法：
 *   data.route / data.path / data.url 完整路径
 *   data.page + data.params（或 data.query）
 *   docId / data.docId（直接开文书）
 */
function deepLink(block) {
  const b = block || {};
  const d = b.data && typeof b.data === "object" ? b.data : {};
  const direct = safeRoute(d.route || d.path || d.url || "");
  if (direct) return direct;

  const page = String(d.page || d.target || "").trim();
  if (page) {
    const base = SHORT_PAGES[page] || safeRoute(page).split("?")[0];
    if (!base) return "";
    const qs = queryString(d.params || d.query);
    return base + (qs ? "?" + qs : "");
  }

  const docId = b.docId != null ? b.docId : d.docId;
  if (docId != null && /^\d+$/.test(String(docId))) {
    return "/pages/draft/draft?id=" + encodeURIComponent(String(docId));
  }
  return "";
}

function baseMeta(block, ctx) {
  const origin = originMeta(block && block.origin);
  return {
    badgeLabel: origin.label,
    badgeTone: origin.tone,
    allowEvidence: origin.allowEvidence,
    sourceText: sourceText(block && block.sourceRefs, ctx.projectName),
    timeText: ctx.time || "",
  };
}

function imageView(block, key, ctx) {
  const meta = baseMeta(block, ctx);
  const title = cleanText((block && (block.caption || block.name)) || "现场图片");
  const no = String(title).match(/#\s*(\d+)/);
  return Object.assign(
    {
      key: key,
      type: "image",
      icon: "cam",
      iconPath: "/assets/icons/cam-blue.png",
      title: title,
      photoNo: no ? "#" + no[1] : "",
      url: absoluteUrl(block && block.url),
      fileType: "",
      route: "",
      imgError: false,
    },
    meta
  );
}

function fileView(block, key, ctx) {
  const meta = baseMeta(block, ctx);
  const title = cleanText((block && (block.name || block.caption)) || "文件");
  // file_ref 的 downloadUrl 带 dl=1（附件下载），没有就退回 content URL
  const src = block && (block.downloadUrl || block.url);
  return Object.assign(
    {
      key: key,
      type: "file",
      icon: "doc",
      iconPath: "/assets/icons/doc-blue.png",
      title: title,
      url: absoluteUrl(src),
      fileType: fileTypeOf(block),
      route: "",
      imgError: false,
    },
    meta
  );
}

function cardView(block, key, ctx) {
  const meta = baseMeta(block, ctx);
  const d = (block && block.data) || {};
  const title = cleanText(
    (block && (block.caption || block.name || block.title)) || d.title || "卡片"
  );
  const sub = cleanText(d.subtitle || d.summary || d.desc || "", 30);
  return Object.assign(
    {
      key: key,
      type: "card",
      icon: "grid",
      iconPath: "/assets/icons/grid-blue.png",
      title: title,
      subtitle: sub,
      url: "",
      fileType: "",
      route: deepLink(block),
      imgError: false,
    },
    meta
  );
}

function emptyView() {
  return {
    hasAny: false,
    hasPrimary: false,
    primary: null,
    secondary: [],
    images: [],
    fallbackText: "",
  };
}

function foldText(type, count) {
  if (count <= 1) return "";
  if (type === "image") return "共 " + count + " 张";
  if (type === "file") return "另有 " + (count - 1) + " 个文件";
  return "另有 " + (count - 1) + " 张卡片";
}

/**
 * 主入口：answer（对象 / JSON 串 / blocks 数组）→ 聊天卡片视图模型。
 * ctx: { projectName, time }
 */
function normalize(answer, ctx) {
  const c = ctx || {};
  const out = emptyView();
  let blocks = answer;
  if (typeof blocks === "string") {
    try {
      blocks = JSON.parse(blocks);
    } catch (e) {
      blocks = null;
    }
  }
  if (blocks && !Array.isArray(blocks) && typeof blocks === "object") {
    blocks = blocks.blocks;
  }
  if (!Array.isArray(blocks) || !blocks.length) return out;

  const images = [];
  const files = [];
  const cards = [];
  const texts = [];
  const lost = []; // 缺字段 / 坏 URL，回退成一行小字

  blocks.forEach((b, i) => {
    if (!b || typeof b !== "object") return;
    const type = String(b.type || "");
    if (type === "text") {
      const t = String(b.text || "").trim();
      if (t) texts.push(t);
      return;
    }
    if (type === "image_ref") {
      const v = imageView(b, "i" + i, c);
      if (v.url) images.push(v);
      else lost.push(v.title || "图片");
      return;
    }
    if (type === "file_ref") {
      const v = fileView(b, "f" + i, c);
      if (v.url) files.push(v);
      else lost.push(v.title || "文件");
      return;
    }
    if (type === "card") {
      const v = cardView(b, "c" + i, c);
      if (v.route) cards.push(v);
      else lost.push(v.title || "卡片");
      return;
    }
    // 未知 type：忽略，保留正文 text fallback
  });

  out.images = images;
  const groups = { image: images, file: files, card: cards };
  const order = ["image", "file", "card"];
  const primaryType = order.filter((t) => groups[t].length)[0];

  if (primaryType) {
    const items = groups[primaryType];
    const p = Object.assign({}, items[0]);
    p.type = primaryType;
    p.items = items;
    p.count = items.length;
    p.footText = foldText(primaryType, items.length);
    p.metaText = [p.sourceText, p.timeText].filter(Boolean).join(" · ");
    out.primary = p;
    out.hasPrimary = true;

    order
      .filter((t) => t !== primaryType && groups[t].length)
      .slice(0, 2)
      .forEach((t) => {
        const items2 = groups[t];
        const row = Object.assign({}, items2[0]);
        row.type = t;
        row.items = items2;
        row.count = items2.length;
        row.footText = foldText(t, items2.length);
        row.metaText = [row.sourceText, row.timeText].filter(Boolean).join(" · ");
        out.secondary.push(row);
      });
  }

  const fb = [];
  // 只有正文没渲染出来（text 为空）才用 text 块兜底，避免和 answer.text 重复
  if (!out.hasPrimary && texts.length) fb.push(texts.join("\n"));
  if (lost.length) fb.push(lost.map((s) => "· " + s).join("\n"));
  out.fallbackText = fb.filter(Boolean).join("\n");
  out.hasAny = !!(out.hasPrimary || out.fallbackText);
  return out;
}

module.exports = {
  normalize,
  absoluteUrl,
  sourceText,
  originMeta,
  fileTypeOf,
  deepLink,
  safeRoute,
  PAGE_WHITELIST,
};

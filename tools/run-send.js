/**
 * 用 Node 跑一遍真实页面逻辑：验证「发消息 → 轮询 → 拿到 AI 回复」。
 *
 * 做法：给 easyCode 的 Page 提供一个假的 wx / getApp，
 * 然后把 wx.request 接到本机隧道（127.0.0.1:8081）上，真的打后端。
 */
const path = require("path");

const BASE = "http://127.0.0.1:8081";

/* ---------------- 最小 wx 实现 ---------------- */
const storage = new Map();
let requested = [];

global.wx = {
  getStorageSync: (k) => (storage.has(k) ? storage.get(k) : ""),
  setStorageSync: (k, v) => storage.set(k, v),
  removeStorageSync: (k) => storage.delete(k),
  nextTick: (fn) => setTimeout(fn, 0),
  showToast: (o) => console.log("  [toast]", o && o.title),
  showModal: () => {},
  navigateTo: (o) => console.log("  [nav]", o.url),
  reLaunch: () => {},
  navigateBack: () => {},
  vibrateShort: () => {},
  hideKeyboard: () => {},
  onKeyboardHeightChange: () => {},
  offKeyboardHeightChange: () => {},
  getWindowInfo: () => ({ windowWidth: 375, screenHeight: 812, statusBarHeight: 47, safeArea: { bottom: 778 } }),
  getSystemInfoSync: () => ({ windowWidth: 375, screenHeight: 812, statusBarHeight: 47 }),
  getMenuButtonBoundingClientRect: () => ({ bottom: 88, top: 30, height: 32 }),
  createSelectorQuery: () => ({
    select: () => ({ fields() { return this; }, boundingClientRect() { return this; } }),
    selectAll: () => ({ boundingClientRect() { return this; } }),
    exec(cb) { cb && cb([null]); },
  }),
  createInnerAudioContext: () => ({ play() {}, stop() {}, onEnded() {}, destroy() {} }),
  getRecorderManager: () => ({ start() {}, stop() {}, onStop() {}, onError() {} }),
  getFileSystemManager: () => ({ saveFileSync: (p) => p }),
  getLocation: () => {},
  // 真请求：走 Node 的 fetch
  request(opts) {
    requested.push(opts.url.replace(BASE, ""));
    fetch(BASE + opts.url.replace(BASE, ""), {
      method: opts.method || "GET",
      headers: opts.header || {},
      body: opts.method === "POST" ? JSON.stringify(opts.data || {}) : undefined,
    })
      .then(async (r) => {
        const text = await r.text();
        let body = text;
        try { body = JSON.parse(text); } catch (e) {}
        if (opts.success) opts.success({ statusCode: r.status, data: body });
      })
      .catch((e) => opts.fail && opts.fail({ errMsg: String(e.message || e) }));
  },
};

const app = { globalData: { token: "t", user: { id: 1, name: "李工" } } };
global.getApp = () => app;
global.getCurrentPages = () => [{}];

/* ---------------- 加载页面 ---------------- */
let pageDef = null;
global.Page = (o) => { pageDef = o; };
require("C:/Users/NJHTR/WeChatProjects/jl/pages/index/index.js");

const page = Object.assign({}, pageDef, {
  data: JSON.parse(JSON.stringify(pageDef.data)),
  setData(patch, cb) {
    Object.keys(patch).forEach((k) => { this.data[k] = patch[k]; });
    if (cb) setTimeout(cb, 0);
  },
});

/* ---------------- 跑一遍 ---------------- */
(async () => {
  console.log("1) 拉首屏");
  page.loadAll();
  await new Promise((r) => setTimeout(r, 2500));
  console.log("   msgs:", page.data.msgs.length, "| project:", page.data.project && page.data.project.name);

  console.log("2) 打字并发送");
  page.onType({ detail: { value: "4#楼东侧外架连墙件少了两根，查规范出通知单" } });
  page.onSend();

  await new Promise((r) => setTimeout(r, 300));
  const pending = page.data.msgs.filter((m) => m.pending);
  console.log("   发出后：pending 气泡", pending.length, "个");

  console.log("3) 等 AI 回来（最多 4 分钟）");
  const t0 = Date.now();
  while (Date.now() - t0 < 240000) {
    await new Promise((r) => setTimeout(r, 3000));
    const still = page.data.msgs.filter((m) => m.pending).length;
    if (!still) break;
    process.stdout.write(".");
  }
  console.log();

  const last = page.data.msgs[page.data.msgs.length - 1];
  console.log("4) 结果");
  console.log("   type:", last.type, "| pending:", !!last.pending);
  console.log("   文本:", (last.text || "").slice(0, 160).replace(/\n/g, " "));
  console.log("   轨迹:", last.traceSum || "无");
  if (last.trace) last.trace.forEach((t) => console.log("     -", t.icon, t.text));
  console.log("   耗时:", last.msLabel || "-");
  console.log("5) 请求序列:", requested.join(" → "));

  const ok = last.type === "agent" && !last.pending && (last.text || "").length > 8;
  console.log(ok ? "\n✅ 通了" : "\n❌ 没拿到回复");
  process.exit(ok ? 0 : 1);
})();

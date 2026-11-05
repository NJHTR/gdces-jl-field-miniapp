const BASE = "http://127.0.0.1:8081";
const storage = new Map();
let logs = [];
global.wx = {
  getStorageSync: (k) => (storage.has(k) ? storage.get(k) : ""),
  setStorageSync: (k, v) => storage.set(k, v),
  removeStorageSync: (k) => storage.delete(k),
  nextTick: (fn) => setTimeout(fn, 0),
  showToast: (o) => logs.push("toast:" + (o && o.title)),
  showModal: () => {}, navigateTo: () => {}, reLaunch: () => {}, navigateBack: () => {},
  vibrateShort: () => {}, hideKeyboard: () => {},
  onKeyboardHeightChange: () => {}, offKeyboardHeightChange: () => {},
  getWindowInfo: () => ({ windowWidth: 375, screenHeight: 812, statusBarHeight: 47, safeArea: { bottom: 778 } }),
  getSystemInfoSync: () => ({ windowWidth: 375, screenHeight: 812, statusBarHeight: 47 }),
  getMenuButtonBoundingClientRect: () => ({ bottom: 88, top: 30, height: 32 }),
  createSelectorQuery: () => ({ select: () => ({ fields(){return this;}, boundingClientRect(){return this;} }),
    selectAll: () => ({ boundingClientRect(){return this;} }), exec(cb){ cb && cb([null]); } }),
  createInnerAudioContext: () => ({ play(){}, stop(){}, onEnded(){}, destroy(){} }),
  getRecorderManager: () => ({ start(){}, stop(){}, onStop(){}, onError(){} }),
  getFileSystemManager: () => ({ saveFileSync: (p) => p }),
  request(opts) {
    fetch(BASE + opts.url.replace(BASE, ""), {
      method: opts.method || "GET", headers: opts.header || {},
      body: opts.method === "POST" ? JSON.stringify(opts.data || {}) : undefined,
    }).then(async (r) => {
      const t = await r.text(); let b = t;
      try { b = JSON.parse(t); } catch (e) {}
      opts.success && opts.success({ statusCode: r.status, data: b });
    }).catch((e) => opts.fail && opts.fail({ errMsg: String(e.message || e) }));
  },
};
global.getApp = () => ({ globalData: { token: "t", user: { id: 1, name: "李工" } } });
global.getCurrentPages = () => [{}];
let pageDef = null;
global.Page = (o) => { pageDef = o; };
const origLog = console.log;
console.log = (...a) => { logs.push(a.join(" ")); };
require("C:/Users/NJHTR/WeChatProjects/jl/pages/index/index.js");
const page = Object.assign({}, pageDef, {
  data: JSON.parse(JSON.stringify(pageDef.data)),
  setData(p, cb) { Object.keys(p).forEach((k) => { this.data[k] = p[k]; }); if (cb) setTimeout(cb, 0); },
});
(async () => {
  page.loadAll();
  await new Promise((r) => setTimeout(r, 2500));
  page.onType({ detail: { value: "4#楼东侧外架连墙件缺失，查规范出通知单" } });
  page.onSend();
  await new Promise((r) => setTimeout(r, 400));
  origLog("发出后 busy =", JSON.stringify(page.data.busy));
  origLog("pending 气泡 =", page.data.msgs.filter((m) => m.pending).length, "个");
  const t0 = Date.now();
  while (Date.now() - t0 < 240000) {
    await new Promise((r) => setTimeout(r, 3000));
    const b = page.data.busy;
    if (b) origLog(`  ${Math.round((Date.now()-t0)/1000)}s  状态条：${b.elapsed}秒 · ${b.step}`);
    if (!b) break;
  }
  const last = page.data.msgs[page.data.msgs.length - 1];
  origLog("结束 busy =", page.data.busy);
  origLog("回复:", (last.text || "").slice(0, 80).replace(/\n/g, " "));
  origLog("产物:", last.artifact ? last.artifact.name : "无");
  origLog("toast:", logs.filter((x) => x.startsWith("toast:")).join(" | "));
  process.exit(0);
})();
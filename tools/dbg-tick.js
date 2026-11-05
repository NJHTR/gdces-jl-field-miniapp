const BASE = "http://127.0.0.1:8081";
const storage = new Map();
global.wx = {
  getStorageSync: (k) => (storage.has(k) ? storage.get(k) : ""),
  setStorageSync: (k, v) => storage.set(k, v), removeStorageSync: () => {},
  nextTick: (f) => setTimeout(f, 0),
  showToast: () => {}, vibrateShort: () => {}, hideKeyboard: () => {},
  getWindowInfo: () => ({ windowWidth: 375, screenHeight: 812, statusBarHeight: 47, safeArea: { bottom: 778 } }),
  getSystemInfoSync: () => ({ windowWidth: 375 }), getMenuButtonBoundingClientRect: () => ({ bottom: 88 }),
  createSelectorQuery: () => ({ select: () => ({ fields(){return this;}, boundingClientRect(){return this;} }),
    selectAll: () => ({ boundingClientRect(){return this;} }), exec(cb){ cb && cb([null]); } }),
  createInnerAudioContext: () => ({ play(){}, stop(){} }),
  getRecorderManager: () => ({ start(){}, stop(){}, onStop(){}, onError(){} }),
  onKeyboardHeightChange(){}, offKeyboardHeightChange(){},
  request(opts) {
    const url = opts.url.replace(BASE, "");
    fetch(BASE + url, { method: opts.method || "GET", headers: opts.header || {},
      body: opts.method === "POST" ? JSON.stringify(opts.data || {}) : undefined })
      .then(async (r) => { const t = await r.text(); let b = t; try { b = JSON.parse(t); } catch(e){}
        opts.success && opts.success({ statusCode: r.status, data: b }); })
      .catch((e) => opts.fail && opts.fail({ errMsg: String(e.message || e) }));
  },
};
global.getApp = () => ({ globalData: { token: "t", user: { id: 1 } } });
global.Page = (o) => { global.__p = o; };
require("C:/Users/NJHTR/WeChatProjects/jl/pages/index/index.js");
const p = global.__p;
const page = Object.assign({}, p, {
  data: JSON.parse(JSON.stringify(p.data)),
  setData(x, cb) { Object.assign(this.data, x); if (cb) setTimeout(cb, 0); },
});
page.scrollToBottom = () => {};
page.refreshViews = () => {};

page.onType({ detail: { value: "测试计时器" } });
page.onSend();

setTimeout(() => {
  const pend = page.data.msgs.filter(m => m.pending)[0];
  console.log("2.5 秒后:");
  console.log("  busy:", page.data.busy && { elapsed: page.data.busy.elapsed, hasTask: !!page.data.busy.taskId });
  console.log("  _busyTimer:", typeof page._busyTimer);
  console.log("  _pendingId:", page._pendingId);
  console.log("  pending.elapsed:", pend && pend.elapsed);
  console.log("  pend.id:", pend && pend.id, "| _pendingId:", page._pendingId, "| 相等:", pend && pend.id === page._pendingId);
  console.log("  msgs ids:", page.data.msgs.map(m => m.id + (m.pending ? "*" : "")).join(", "));
  process.exit(0);
}, 2500);
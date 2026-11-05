const BASE = "http://127.0.0.1:8081";
const storage = new Map();
global.wx = {
  getStorageSync: (k) => (storage.has(k) ? storage.get(k) : ""),
  setStorageSync: (k, v) => storage.set(k, v), removeStorageSync: () => {},
  nextTick: (f) => setTimeout(f, 0),
  showToast: (o) => {}, vibrateShort: () => {}, hideKeyboard: () => {},
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
  setData(x, cb) { Object.assign(this.data, x); cb && setTimeout(cb, 0); },
});
page.scrollToBottom = () => {};

(async () => {
  page.loadAll();
  await new Promise(r => setTimeout(r, 2000));
  page.onType({ detail: { value: "4#楼连墙件缺失，查规范出通知单" } });
  page.onSend();
  await new Promise(r => setTimeout(r, 500));
  let pend = page.data.msgs.filter(m => m.pending)[0];
  console.log("发出 0.5s：pending 在列表里 =", !!pend, "| 秒数 =", pend && pend.elapsed);
  for (let i = 0; i < 6; i++) {
    await new Promise(r => setTimeout(r, 8000));
    pend = page.data.msgs.filter(m => m.pending)[0];
    if (!pend) break;
    if (!pend.progress) pend.progress = [];
    console.log(`  ${(i+1)*8}s：处理中 ${pend.elapsed} 秒 | 步骤 ${pend.progress.length} 条` +
      (pend.progress.length ? " | " + pend.progress.map(s => s.label.slice(0,10) + (s.secs ? `(${s.secs}s)` : "")).join(", ") : ""));
  }
  const last = page.data.msgs[page.data.msgs.length - 1];
  console.log("结束：pending =", page.data.msgs.filter(m => m.pending).length, "| 回复 =", (last.text||"").slice(0,50), "| 产物 =", last.artifact ? last.artifact.name : "无");
  process.exit(0);
})();
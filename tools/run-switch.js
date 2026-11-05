const BASE = "http://127.0.0.1:8081";
const storage = new Map();
let calls = [];
global.wx = {
  getStorageSync: (k) => (storage.has(k) ? storage.get(k) : ""),
  setStorageSync: (k, v) => storage.set(k, v), removeStorageSync: (k) => storage.delete(k),
  nextTick: (f) => setTimeout(f, 0),
  showToast: (o) => calls.push("toast:" + (o && o.title)),
  showActionSheet: (o) => { calls.push("sheet[" + o.itemList.join(" / ") + "]"); o.success && o.success({ tapIndex: 0 }); },
  showModal: () => {}, navigateTo: () => {}, vibrateShort: () => {}, hideKeyboard: () => {},
  getWindowInfo: () => ({ windowWidth: 375, screenHeight: 812, statusBarHeight: 47, safeArea: { bottom: 778 } }),
  getSystemInfoSync: () => ({ windowWidth: 375 }),
  getMenuButtonBoundingClientRect: () => ({ bottom: 88 }),
  createSelectorQuery: () => ({ select: () => ({ fields(){return this;}, boundingClientRect(){return this;} }),
    selectAll: () => ({ boundingClientRect(){return this;} }), exec(cb){ cb && cb([null]); } }),
  createInnerAudioContext: () => ({ play(){}, stop(){} }),
  getRecorderManager: () => ({ start(){}, stop(){}, onStop(){}, onError(){} }),
  onKeyboardHeightChange(){}, offKeyboardHeightChange(){},
  request(opts) {
    const url = opts.url.replace(BASE, "");
    calls.push("GET " + url);
    fetch(BASE + url, { method: opts.method || "GET", headers: opts.header || {},
      body: opts.method === "POST" ? JSON.stringify(opts.data || {}) : undefined })
      .then(async (r) => { const t = await r.text(); let b = t; try { b = JSON.parse(t); } catch(e){}
        opts.success && opts.success({ statusCode: r.status, data: b }); })
      .catch((e) => { calls.push("FAIL " + url + " " + e.message); opts.fail && opts.fail({ errMsg: String(e.message || e) }); });
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
  console.log("1) 首屏");
  page.loadAll();
  await new Promise(r => setTimeout(r, 2500));
  console.log("   项目:", page.data.project.id, "|", page.data.project.name, "| 消息:", page.data.msgs.length, "| 文书:", page.data.docs.length);

  console.log("2) 切项目");
  page.onProjectTap();
  await new Promise(r => setTimeout(r, 3000));
  console.log("   项目:", page.data.project.id, "|", page.data.project.name, "| 消息:", page.data.msgs.length, "| 文书:", page.data.docs.length);
  console.log("   存储:", storage.get("jl_project"));
  console.log("   调用:", calls.join("\n         "));
  process.exit(0);
})();
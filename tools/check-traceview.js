const BASE = "http://127.0.0.1:8081";
global.wx = { getStorageSync: () => "", setStorageSync(){}, removeStorageSync(){}, nextTick:(f)=>setTimeout(f,0),
  showToast(){}, vibrateShort(){}, hideKeyboard(){}, onKeyboardHeightChange(){}, offKeyboardHeightChange(){},
  getWindowInfo: () => ({ windowWidth: 375, screenHeight: 812, statusBarHeight: 47, safeArea: { bottom: 778 } }),
  getSystemInfoSync: () => ({ windowWidth: 375 }), getMenuButtonBoundingClientRect: () => ({ bottom: 88 }),
  createSelectorQuery: () => ({ select: () => ({ fields(){return this;}, boundingClientRect(){return this;} }),
    selectAll: () => ({ boundingClientRect(){return this;} }), exec(cb){ cb && cb([null]); } }),
  createInnerAudioContext: () => ({ play(){}, stop(){} }),
  getRecorderManager: () => ({ start(){}, stop(){}, onStop(){}, onError(){} }),
  request(opts) {
    const url = opts.url.replace(BASE, "");
    fetch(BASE + url).then(async (r) => { const t = await r.text(); let b = t; try { b = JSON.parse(t); } catch(e){}
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

(async () => {
  page.loadAll();
  await new Promise(r => setTimeout(r, 2500));
  // 直接看 refreshViews 产出的 traceView
  page._traceOpen = {};
  const lastAgent = page.data.msgs.filter(m => m.type === "agent" && m.trace && m.trace.length).pop();
  if (!lastAgent) { console.log("没有带时间线的消息"); process.exit(0); }
  page.refreshViews("");
  const view = page.data.msgsView.filter(m => m.id === lastAgent.id)[0];
  console.log("消息:", lastAgent.id, "| 条目:", view.traceView.length);
  view.traceView.forEach((t, i) => {
    const c = (t.cmd || t.args || "").slice(0, 40);
    console.log(`  ${i} kind=${t.kind || "(无)"} | text=${(t.text||"").slice(0,20)} | cmd=${c ? "有("+t.cmd?.length+")" : "无"} | out=${t.output ? t.output.length + "字节" : "无"} | secs=${t.secs}`);
  });
  process.exit(0);
})();
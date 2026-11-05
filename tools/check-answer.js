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
    fetch(BASE + opts.url).then(async (r) => { const t = await r.text(); let b = t; try { b = JSON.parse(t); } catch(e){}
      opts.success && opts.success({ statusCode: r.status, data: b }); }).catch(()=>{});
  },
};
global.getApp = () => ({ globalData: { token: "t", user: { id: 1 } } });
global.Page = (o) => { global.__p = o; };
require("C:/Users/NJHTR/WeChatProjects/jl/pages/index/index.js");
const p = global.__p;
const page = Object.assign({}, p, { data: JSON.parse(JSON.stringify(p.data)),
  setData(x, cb) { Object.assign(this.data, x); if (cb) setTimeout(cb, 0); } });
page.scrollToBottom = () => {};
(async () => {
  page.loadAll();
  await new Promise(r => setTimeout(r, 2500));
  const ages = page.data.msgs.filter(m => m.type === "agent" && m.answer);
  console.log("带结构化回答的消息:", ages.length);
  if (!ages.length) { console.log("（还没有新格式的消息）"); process.exit(0); }
  const m = ages[ages.length - 1];
  console.log("结论片段:", JSON.stringify(m.answer.conclusionRich));
  console.log("待补 chips:", JSON.stringify(m.answer.gapItems));
  process.exit(0);
})();
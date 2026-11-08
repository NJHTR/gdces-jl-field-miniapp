/**
 * 本地数据仓：项目信息 / 生成的文书 / 现场影像。
 * 小程序没有后端时也能跑通全流程，接了 API 之后这里换成请求即可。
 */

const K_PROJECT = "jl_project";
const K_DOCS = "jl_docs";
const K_PHOTOS = "jl_photos";

const DEFAULT_PROJECT = {
  id: "yun-gu-3qi",
  name: "云谷智造园 · 3期",
  code: "GZ-2026-031",
  addr: "深圳市南山区科技园北区 A-3-2",
  owner: "云谷科技（深圳）有限公司", // 建设单位
  design: "深圳市建筑设计研究总院", // 设计单位
  survey: "广东省地质工程勘察院", // 勘察单位
  builder: "中建八局华南公司", // 施工单位
  supervisor: "广东建设工程监理有限公司", // 监理单位
  category: "房屋建筑",
  area: "186000",
  floors: "地上 32 / 地下 3",
  structure: "框架-剪力墙",
  cost: "9.8",
  start: "2026-03-01",
  finish: "2028-09-30",
  license: "4403002026030101",
  bureau: "南山区建设工程质量安全监督站",
  chief: "陈志明",
  reps: "李建国、周涛",
  contract: "JL-2026-031",
};

function read(key, fallback) {
  try {
    const v = wx.getStorageSync(key);
    return v || fallback;
  } catch (e) {
    return fallback;
  }
}

function write(key, value) {
  try {
    wx.setStorageSync(key, value);
  } catch (e) {}
}

/* ---------------- 项目 ---------------- */

function project() {
  return Object.assign({}, DEFAULT_PROJECT, read(K_PROJECT, null) || {});
}

function saveProject(obj) {
  write(K_PROJECT, obj);
  return obj;
}

/* ---------------- 文书 ---------------- */

function docs() {
  return read(K_DOCS, []) || [];
}

function addDoc(doc) {
  const list = docs();
  list.unshift(doc);
  write(K_DOCS, list);
  return list;
}

/* ---------------- 影像 ---------------- */

function photos() {
  return read(K_PHOTOS, []) || [];
}

function addPhoto(p) {
  const list = photos();
  list.unshift(p);
  write(K_PHOTOS, list);
  return list;
}

/** 水印要用的四行信息 */
function watermarkInfo() {
  const p = project();
  const now = new Date();
  const pad = (n) => (n < 10 ? "0" + n : "" + n);
  return {
    project: p.name,
    place: p.addr,
    time:
      now.getFullYear() +
      "-" +
      pad(now.getMonth() + 1) +
      "-" +
      pad(now.getDate()) +
      " " +
      pad(now.getHours()) +
      ":" +
      pad(now.getMinutes()),
    weather: "多云 26℃", // 真机接天气接口后替换
  };
}

module.exports = {
  DEFAULT_PROJECT,
  project,
  saveProject,
  docs,
  addDoc,
  photos,
  addPhoto,
  watermarkInfo,
};

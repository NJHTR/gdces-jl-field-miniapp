/**
 * 定位与天气。
 *
 * 分工：
 *   前端  —— 拿经纬度（wx.getLocation）、拿当前时间
 *   后端  —— 逆地理编码出中文地址、调第三方天气（key 不下发到小程序）
 *
 * 拿不到就退回项目信息里的地址，天气显示"—"，不让流程卡住。
 */

const api = require("./request");
const store = require("./store");

let cachedLoc = null;
let cachedWx = null;
let cachedAt = 0;

/** 取经纬度，失败返回 null（不抛异常） */
function locate() {
  if (cachedLoc) return Promise.resolve(cachedLoc);

  return new Promise((resolve) => {
    wx.getLocation({
      type: "gcj02",
      isHighAccuracy: false,
      success: (res) => {
        cachedLoc = { lat: res.latitude, lng: res.longitude };
        resolve(cachedLoc);
      },
      fail: () => resolve(null),
    });
  });
}

/** 逆地理编码：坐标 → 中文地址（走自己的后端） */
function reverse(loc) {
  if (!loc) return Promise.resolve(store.project().addr || "");
  return api
    .get("/api/v1/geo/reverse?lat=" + loc.lat + "&lng=" + loc.lng)
    .then((d) => (d && d.address) || store.project().addr || "")
    .catch(() => store.project().addr || "");
}

/** 天气（走自己的后端，key 不进小程序） */
function weather(loc) {
  if (cachedWx && Date.now() - cachedAt < 10 * 60 * 1000) return Promise.resolve(cachedWx);

  const q = loc ? "?lat=" + loc.lat + "&lng=" + loc.lng : "";
  return api
    .get("/api/v1/weather" + q)
    .then((d) => {
      const w = {
        text: (d && d.text) || "",
        temp: d && typeof d.temp === "number" ? d.temp : null,
      };
      cachedWx = w;
      cachedAt = Date.now();
      return w;
    })
    .catch(() => ({ text: "", temp: null }));
}

/**
 * 水印要用的四行。定位和天气并行取，任一失败都不影响出图。
 */
function watermark(opts) {
  const o = opts || {};
  const p = store.project();
  const now = new Date();
  const pad = (n) => (n < 10 ? "0" + n : "" + n);
  const time =
    now.getFullYear() +
    "-" +
    pad(now.getMonth() + 1) +
    "-" +
    pad(now.getDate()) +
    " " +
    pad(now.getHours()) +
    ":" +
    pad(now.getMinutes());

  // o.loc：外部指定的坐标（地图选点）；o.addr：外部指定的地址
  const locP = o.loc ? Promise.resolve(o.loc) : locate();
  return locP.then((loc) =>
    Promise.all([o.addr ? Promise.resolve(o.addr) : reverse(loc), weather(loc)]).then(([addr, w]) => ({
      project: p.name,
      place: addr || p.addr || "",
      time,
      // 没有真实天气就留空（宁可不显示，也不编一个「多云 26℃」）
      weather: w.temp === null ? w.text || "" : (w.text ? w.text + " " : "") + w.temp + "℃",
      lat: loc ? loc.lat : null,
      lng: loc ? loc.lng : null,
    }))
  );
}

module.exports = { locate, reverse, weather, watermark };

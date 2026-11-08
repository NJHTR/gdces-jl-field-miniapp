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
let cachedWxKey = "";
let cachedAt = 0;

/** 取经纬度，失败返回 null（不抛异常） */
function locate() {
  if (cachedLoc) return Promise.resolve(cachedLoc);

  return new Promise((resolve) => {
    wx.getLocation({
      type: "gcj02",
      isHighAccuracy: true,
      highAccuracyExpireTime: 4000,
      altitude: true,
      success: (res) => {
        cachedLoc = {
          lat: res.latitude,
          lng: res.longitude,
          accuracy: res.accuracy,
          altitude: res.altitude,
          verticalAccuracy: res.verticalAccuracy,
        };
        resolve(cachedLoc);
      },
      fail: () => resolve(null),
    });
  });
}

/**
 * 逆地理：坐标 → 中文地址（走自己的后端）
 * 返回 {address, source, detail}；source=project 表示只是项目地址兜底，不是 GPS 地址。
 */
function reverse(loc) {
  const p = store.project();
  const projectAddr = p.addr || "";
  if (!loc) return Promise.resolve({ address: projectAddr, source: "project" });
  return api
    .get("/api/v1/geo/reverse?projectId=" + encodeURIComponent(p.id || "") +
         "&lat=" + loc.lat + "&lng=" + loc.lng)
    .then((d) => ({
      address: (d && d.address) || projectAddr,
      source: (d && d.source) || "geo",
      detail: d || null,
    }))
    .catch(() => ({ address: projectAddr, source: "project" }));
}

/** 天气（走自己的后端，key 不进小程序） */
function weather(loc) {
  // 没有坐标就不取天气，更不能把「无坐标」的空结果缓存给下一次真定位用
  if (!loc) return Promise.resolve({ text: "", temp: null });
  const key = loc.lat + "," + loc.lng;
  if (cachedWx && cachedWxKey === key && Date.now() - cachedAt < 10 * 60 * 1000) {
    return Promise.resolve(cachedWx);
  }

  const q = "?lat=" + loc.lat + "&lng=" + loc.lng;
  return api
    .get("/api/v1/weather" + q)
    .then((d) => {
      cachedWx = Object.assign({ text: "", temp: null }, d || {});
      cachedWxKey = key;
      cachedAt = Date.now();
      return cachedWx;
    })
    .catch(() => ({ text: "", temp: null }));
}

/** 把后端天气对象格式化成水印两行；缺数据就留空，绝不编 */
function formatWeather(w) {
  let text = "";
  let extra = "";
  if (w && (w.text || (w.temp !== null && w.temp !== undefined))) {
    text = w.text || "";
    if (w.temp !== null && w.temp !== undefined) {
      text += (text ? " " : "") + w.temp + "℃";
    }
    const extras = [];
    if (w.humidity !== null && w.humidity !== undefined) extras.push("湿度" + w.humidity + "%");
    if (w.wind_dir_text) extras.push(w.wind_dir_text + (w.wind_level || ""));
    if (w.precipitation !== null && w.precipitation !== undefined && Number(w.precipitation) > 0) {
      extras.push("降水" + w.precipitation + "mm");
    }
    extra = extras.join(" · ");
  }
  return { text, extra };
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
  const addrP = o.addr ? Promise.resolve({ address: o.addr, source: "map" }) : null;
  return locP.then((loc) =>
    Promise.all([addrP || reverse(loc), weather(loc)]).then(([addr, w]) => {
      const fw = formatWeather(w);
      return {
        project: p.name,
        place: (addr && addr.address) || p.addr || "",
        addressSource: (addr && addr.source) || "project",
        addressDetail: (addr && addr.detail) || null,
        time,
        weather: fw.text,
        weatherExtra: fw.extra,
        weatherDetail: w || null,
        lat: loc ? loc.lat : null,
        lng: loc ? loc.lng : null,
        accuracy: loc ? loc.accuracy : null,
        altitude: loc ? loc.altitude : null,
      };
    })
  );
}

module.exports = { locate, reverse, weather, formatWeather, watermark };

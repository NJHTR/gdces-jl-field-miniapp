/**
 * 统一请求层。
 *
 * 现在后端还没上，这里用「本地假数据 + 人为延迟」跑通三件事：
 *   1. 页面四态：loading → ready | empty | error
 *   2. 401 自动清会话、跳登录
 *   3. 换真后端时，只改 MOCK = false 和 config.API_BASE
 */

const { API_BASE } = require("./config");
const session = require("./session");

const MOCK = !API_BASE;

/** 模拟网络延迟，用来暴露页面的加载态 */
const LATENCY = 420;

/** 全局网络开关，测试断网表现时置 false */
let online = true;

function setOnline(v) {
  online = !!v;
}

function token() {
  const s = session.get();
  return (s && s.token) || "";
}

/** 未授权：清会话，抛给调用方跳登录 */
function kickToLogin() {
  try {
    session.clear();
  } catch (e) {}
  try {
    const app = getApp();
    if (app && app.globalData) {
      app.globalData.token = "";
      app.globalData.user = null;
    }
  } catch (e) {}
  try {
    wx.navigateTo({ url: "/pages/login/login" });
  } catch (e) {}
}

function request(method, path, data) {
  return new Promise((resolve, reject) => {
    if (!online) {
      setTimeout(() => reject(Object.assign(new Error("网络不可用"), { code: "NETWORK" })), 260);
      return;
    }

    if (MOCK) {
      setTimeout(() => {
        const mock = require("./mock");
        const hit = mock.resolve(method, path, data);
        if (!hit) {
          reject(Object.assign(new Error("接口未实现: " + path), { code: "NOT_IMPL" }));
          return;
        }
        if (hit.status === 401) {
          kickToLogin();
          reject(Object.assign(new Error("登录已失效"), { code: "UNAUTH" }));
          return;
        }
        resolve(hit.data);
      }, LATENCY);
      return;
    }

    wx.request({
      url: API_BASE + path,
      method,
      data,
      timeout: 15000,
      header: {
        "content-type": "application/json",
        authorization: token() ? "Bearer " + token() : "",
      },
      success(res) {
        if (res.statusCode === 401) {
          kickToLogin();
          reject(Object.assign(new Error("登录已失效"), { code: "UNAUTH" }));
          return;
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          // 后端统一返回 { code, message, data }，这里剥掉外壳，
          // 调用方拿到的就是数据本身（和 mock 的形态一致）
          const body = res.data || {};
          const unwrapped =
            body && typeof body.code === "number" && "data" in body ? body.data : body;
          resolve(unwrapped);
          return;
        }
        reject(Object.assign(new Error((res.data && res.data.message) || "请求失败"), { code: res.statusCode }));
      },
      fail(err) {
        reject(Object.assign(new Error((err && err.errMsg) || "网络异常"), { code: "NETWORK" }));
      },
    });
  });
}

module.exports = {
  MOCK,
  setOnline,
  get: (p, d) => request("GET", p, d),
  post: (p, d) => request("POST", p, d),
  put: (p, d) => request("PUT", p, d),
  del: (p, d) => request("DELETE", p, d),
};

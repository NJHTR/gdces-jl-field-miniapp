/**
 * 登录相关接口。
 * 演示模式（config.API_BASE 为空）不请求服务器，直接放行，先把界面跑通。
 */
const { API_BASE } = require("./config");

const DEMO = !API_BASE;

function post(path, data) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: API_BASE + path,
      method: "POST",
      data,
      header: { "content-type": "application/json" },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const body = res.data || {};
          resolve(body && typeof body.code === "number" && "data" in body ? body.data : body);
        } else {
          reject(new Error((res.data && res.data.message) || "登录失败"));
        }
      },
      fail(err) {
        reject(new Error((err && err.errMsg) || "网络异常"));
      },
    });
  });
}

/**
 * 用 wx.login 拿到的 code 换会话。
 * 后端建议：code -> openid/unionid -> 查员工 -> 签发 token
 */
function wxLogin(code) {
  if (DEMO) {
    return Promise.resolve({
      token: "demo-" + Date.now(),
      user: {
        id: "demo",
        name: "李工",
        role: "监理员",
        project: "云谷智造园 · 3期",
      },
    });
  }
  return post("/api/v1/auth/wx-login", { code });
}

/** 可选：手机号绑定（需企业认证 + getPhoneNumber） */
function bindPhone(code) {
  if (DEMO) return Promise.resolve({ phone: "138****0000" });
  return post("/api/v1/auth/wx-phone", { code });
}

module.exports = { wxLogin, bindPhone, DEMO };

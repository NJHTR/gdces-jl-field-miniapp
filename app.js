// app.js
const session = require("./utils/session");

App({
  globalData: {
    user: null,
    token: "",
  },

  onLaunch() {
    // 有本地会话就直接恢复，登录页会据此自动跳转
    const saved = session.get();
    if (saved) {
      this.globalData.user = saved.user;
      this.globalData.token = saved.token;
    }
  },

  /** 登录成功后统一写入 */
  setSession(payload) {
    this.globalData.user = payload.user;
    this.globalData.token = payload.token;
    session.save(payload);
  },

  /** 退出登录 */
  clearSession() {
    this.globalData.user = null;
    this.globalData.token = "";
    session.clear();
  },
});

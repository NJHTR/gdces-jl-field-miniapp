/**
 * 本地会话存储。
 * 只存 token 与最小用户信息，不存任何业务数据。
 */
const KEY = "jl_session";

function get() {
  try {
    const value = wx.getStorageSync(KEY);
    if (!value || !value.token) return null;
    return value;
  } catch (e) {
    return null;
  }
}

function save(payload) {
  try {
    wx.setStorageSync(KEY, {
      token: payload.token,
      user: payload.user,
      savedAt: Date.now(),
    });
  } catch (e) {
    // 存储失败不阻断登录流程
  }
}

function clear() {
  try {
    wx.removeStorageSync(KEY);
  } catch (e) {}
}

module.exports = { get, save, clear };

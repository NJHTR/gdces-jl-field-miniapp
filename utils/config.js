/**
 * 两块地址，分别对应两种跑法：
 *
 * API_BASE —— 后端接口。留空 = 演示模式（不请求服务器，直接放行）。
 *             现在指向本机 8081，是 SSH 隧道：
 *             ssh -N -L 8081:127.0.0.1:8081 rokid-r640
 *             微信开发者工具里要勾「不校验合法域名」。
 *
 * H5_BASE  —— 原型/H5 版本地址，web-view 直接加载它。
 *              必须带结尾斜杠，否则 nginx 的 location /lab/ 匹配不上。
 */
function apiBase() {
  // 手机真机调试时可在控制台设置：
  //   wx.setStorageSync("jl_api_base", "http://10.48.53.146:8081")
  // 或 Tailscale：http://100.112.199.126:8081
  // 不设置时仍走本机 SSH 隧道（127.0.0.1:8081）。
  try {
    if (typeof wx !== "undefined") {
      const v = wx.getStorageSync("jl_api_base");
      if (v) return v;
    }
  } catch (e) {}
  // 手机预览走电脑热点（手机 192.168.137.x，电脑热点网关 192.168.137.1）。
  // 桌面开发如果走 127.0.0.1 隧道，可 setStorageSync 覆盖。
  return "http://192.168.137.1:8081";
}

module.exports = {
  API_BASE: apiBase(),
  H5_BASE: "https://www.baize.gdces.cn/lab/",
};
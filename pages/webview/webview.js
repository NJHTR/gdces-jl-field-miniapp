const { H5_BASE } = require("../../utils/config");

Page({
  data: {
    url: "",
    missing: false,
  },

  onLoad(options) {
    const opt = options || {};
    // 优先级：启动参数 > 配置 > 开发者工具里兜底用 localhost
    let base = opt.url ? decodeURIComponent(opt.url) : H5_BASE;

    if (!base) {
      try {
        const info = wx.getSystemInfoSync();
        if (info.platform === "devtools") {
          base = "http://localhost:3000";
          console.log("[webview] 没配 H5_BASE，开发者工具里用 localhost:3000 兜底");
        }
      } catch (e) {}
    }

    if (!base) {
      this.setData({ missing: true });
      return;
    }

    const sep = base.indexOf("?") >= 0 ? "&" : "?";
    // 只带 embed=1：H5 的 state 默认就是 field，少一个 & 少一处转义风险
    const url = base + sep + "embed=1";

    this.setData({ url });
  },

  /** H5 里通过 wx.miniProgram.postMessage 发过来的消息 */
  onMessage(e) {
    const list = (e && e.detail && e.detail.data) || [];
    const last = list[list.length - 1] || {};
    if (last.type === "toast") {
      wx.showToast({ title: last.text || "", icon: "none" });
    }
  },

  onError(e) {
    console.error("web-view error", e);
    wx.showToast({ title: "H5 打不开，检查域名配置", icon: "none" });
  },

  /** 开发时用：用局域网地址直接注入 */
  useLocal() {
    wx.showModal({
      title: "本地调试",
      content: "先把 utils/config.js 的 H5_BASE 改成局域网地址，例如 http://192.168.1.5:3000，并在开发者工具里勾选「不校验合法域名」。",
      showCancel: false,
    });
  },
});

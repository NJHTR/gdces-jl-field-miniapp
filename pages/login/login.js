const api = require("../../utils/api");
const session = require("../../utils/session");
const fb = require("../../utils/feedback");

Page({
  data: {
    agreed: false,
    loading: false,
    demo: api.DEMO,
    canBack: false,
    action: "",
  },

  onLoad(options) {
    const pages = getCurrentPages();
    this.setData({
      canBack: pages.length > 1,
      action: (options && options.action) || "",
    });

    // 已登录就不用再登一次
    if (session.get()) {
      this.back({ toast: "已登录" });
    }
  },

  toggleAgree() {
    this.setData({ agreed: !this.data.agreed });
  },

  onLogin() {
    if (this.data.loading) return;

    if (!this.data.agreed) {
      wx.showToast({ title: "请先勾选同意", icon: "none" });
      return;
    }

    this.setData({ loading: true });

    wx.login({
      success: (res) => {
        if (!res.code) {
          this.fail("微信登录失败，请重试");
          return;
        }
        api
          .wxLogin(res.code)
          .then((data) => {
            getApp().setSession(data);
            fb.success();
            this.back({ toast: "登录成功" });
          })
          .catch((err) => {
            this.fail(err.message || "登录失败");
          });
      },
      fail: () => {
        this.fail("微信登录失败，请检查网络");
      },
    });
  },

  /** 从主页进来的，登录完退回去；直接进来的，回首页 */
  back(opts) {
    const options = opts || {};
    if (options.toast) {
      wx.showToast({ title: options.toast, icon: "none" });
    }
    setTimeout(() => {
      if (this.data.canBack) {
        wx.navigateBack({ delta: 1 });
      } else {
        wx.reLaunch({ url: "/pages/index/index" });
      }
    }, options.toast ? 500 : 0);
  },

  onClose() {
    if (this.data.canBack) {
      wx.navigateBack({ delta: 1 });
    } else {
      wx.reLaunch({ url: "/pages/index/index" });
    }
  },

  fail(message) {
    this.setData({ loading: false });
    wx.showToast({ title: message, icon: "none" });
  },

  openAgreement() {
    wx.showModal({
      title: "用户协议与隐私政策",
      content: "本应用仅限广东建设工程监理有限公司员工使用，登录即表示同意公司内部资料管理与保密要求。",
      showCancel: false,
      confirmText: "知道了",
    });
  },
});

const api = require("../../utils/request");
const store = require("../../utils/store");
const { API_BASE } = require("../../utils/config");

function today() {
  const d = new Date();
  const p = (n) => (n < 10 ? "0" + n : "" + n);
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}

function daysAgo(n) {
  const d = new Date(Date.now() - n * 86400000);
  const p = (x) => (x < 10 ? "0" + x : "" + x);
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}

Page({
  data: {
    from: daysAgo(6),
    to: today(),
    inspector: "",
    busy: false,
    info: "",
    file: null,
    err: "",
  },

  onLoad() {
    const app = getApp();
    const u = (app.globalData && app.globalData.user) || {};
    this.setData({ inspector: u.name || "" });
  },

  onBack() {
    wx.navigateBack({ delta: 1 });
  },

  onInspector(e) {
    this.setData({ inspector: e.detail.value });
  },

  onFrom(e) {
    this.setData({ from: e.detail.value, file: null, err: "" });
  },

  onTo(e) {
    this.setData({ to: e.detail.value, file: null, err: "" });
  },

  /** 生成：服务端出 docx → 下载 → 用微信打开（可转发/保存） */
  onGenerate() {
    if (this.data.busy) return;
    const from = this.data.from;
    const to = this.data.to;
    if (from > to) {
      wx.showToast({ title: "开始日期不能晚于结束日期", icon: "none" });
      return;
    }
    this.setData({ busy: true, err: "", info: "正在汇总这几天的记录…" });

    api
      .post("/api/v1/reports/patrol", {
        projectId: this._projectId(),
        from,
        to,
        inspector: this.data.inspector,
      })
      .then((d) => {
        if (!d || !d.url) throw new Error("没有拿到文件地址");
        const info =
          "覆盖 " + d.days + " 天 · 文书 " + d.docs + " 份 · 影像 " + d.photos + " 张";
        this.setData({ info });
        return this._download(d.url, d.name);
      })
      .then((res) => {
        this.setData({ busy: false, file: res });
      })
      .catch((e) => {
        const msg = (e && (e.message || e.errMsg)) || "生成失败";
        this.setData({ busy: false, err: msg, info: "" });
      });
  },

  /** 下载到本地再打开：小程序不能直接打开网络 docx */
  _download(url, name) {
    const full = /^https?:\/\//.test(url) ? url : API_BASE + url;
    const token = wx.getStorageSync("token") || "";
    return new Promise((resolve, reject) => {
      wx.downloadFile({
        url: full,
        header: token ? { authorization: "Bearer " + token } : {},
        timeout: 60000,
        success: (res) => {
          if (res.statusCode !== 200) {
            reject(new Error("下载失败 HTTP " + res.statusCode));
            return;
          }
          resolve({ path: res.tempFilePath, name: name || "巡视记录.docx" });
        },
        fail: (err) => reject(new Error((err && err.errMsg) || "下载失败")),
      });
    });
  },

  /** 用微信内置文档查看器打开（右上角可转发/保存到手机） */
  onOpen() {
    const f = this.data.file;
    if (!f) return;
    wx.openDocument({
      filePath: f.path,
      fileType: "docx",
      showMenu: true,
      success: () => {},
      fail: (err) =>
        wx.showModal({
          title: "打不开文档",
          content:
            ((err && err.errMsg) || "") +
            "\n可以点「转发给同事」，或到开发者工具里查看生成的文件。",
          showCancel: false,
        }),
    });
  },

  _projectId() {
    // 首页把项目 id 存成字符串（jl_project），store 里可能只有名字
    try {
      const saved = wx.getStorageSync("jl_project");
      if (typeof saved === "string" && saved) return saved;
      if (saved && saved.id) return saved.id;
    } catch (e) {}
    const p = store.project() || {};
    const app = getApp();
    const g = (app.globalData && app.globalData.project) || {};
    return p.id || g.id || "yun-gu-3qi";
  },
});

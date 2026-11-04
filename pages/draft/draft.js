const store = require("../../utils/store");

const DOCS = {
  旁站记录: {
    sub: "3#5F 顶板 · 09:12–10:24",
    groups: [
      {
        label: "基本信息",
        rows: [
          { k: "部位", v: "3#5F 顶板" },
          { k: "工序", v: "钢筋绑扎 / 浇筑" },
          { k: "起止", v: "09:12 – 10:24" },
        ],
      },
      {
        label: "待补",
        rows: [
          { k: "方量", v: "", missing: true },
          { k: "试块组数", v: "", missing: true },
        ],
      },
      {
        label: "现场情况",
        rows: [
          { k: "坍落度", v: "180mm" },
          { k: "气温", v: "26℃" },
        ],
      },
    ],
  },
  监理通知单: {
    sub: "NO-017 · 4#楼外架",
    groups: [
      {
        label: "基本信息",
        rows: [
          { k: "受检单位", v: "中建八局 · 外架班组" },
          { k: "检查部位", v: "4#楼东侧外架" },
          { k: "事由", v: "连墙件缺失 2 处，未按方案设置" },
        ],
      },
      {
        label: "待补",
        rows: [
          { k: "整改期限", v: "", missing: true },
          { k: "签发人", v: "", missing: true },
        ],
      },
      {
        label: "依据",
        rows: [{ k: "规范", v: "JGJ 130-2011 第 6.4.3 条" }],
      },
    ],
  },
  监理日志: {
    sub: "11-03 · 汇总 6 条",
    groups: [
      {
        label: "基本信息",
        rows: [
          { k: "日期", v: "2026-11-03 周二" },
          { k: "施工部位", v: "3#5F 顶板 / 4#楼外架" },
        ],
      },
      {
        label: "待补",
        rows: [
          { k: "天气", v: "", missing: true },
          { k: "在场人数", v: "", missing: true },
        ],
      },
      {
        label: "今日工作",
        rows: [
          { k: "旁站", v: "顶板浇筑，坍落度合格" },
          { k: "巡视", v: "外架连墙件缺失，已下通知单" },
        ],
      },
    ],
  },
};

Page({
  data: {
    title: "旁站记录",
    sub: "",
    groups: [],
    missingCount: 0,
    hdrTop: 52,
    bottomPad: 48,
  },

  onLoad(options) {
    const opt = options || {};

    // 全局是自定义导航，详情页要自己让出状态栏和 Home 条
    try {
      const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      const statusBar = info.statusBarHeight || 44;
      const screenH = info.screenHeight || info.windowHeight || 812;
      const safeBottom = (info.safeArea && info.safeArea.bottom) || screenH;
      const inset = Math.max(0, screenH - safeBottom);

      // 和首页一致：整体下移到微信胶囊下方，右侧按钮不会被压
      let hdrTop = statusBar + 48;
      try {
        const menu = wx.getMenuButtonBoundingClientRect();
        if (menu && menu.bottom) hdrTop = menu.bottom + 10;
      } catch (e2) {}

      this.setData({
        hdrTop: Math.round(hdrTop),
        bottomPad: Math.max(40, inset + 24),
      });
    } catch (e) {}
    const kind = decodeURIComponent(opt.kind || "旁站记录");
    const conf = DOCS[kind] || DOCS["旁站记录"];

    let missing = 0;
    conf.groups.forEach((g) => g.rows.forEach((r) => r.missing && missing++));

    this.setData({
      title: kind,
      sub: decodeURIComponent(opt.obj || "") || conf.sub,
      groups: conf.groups,
      missingCount: missing,
    });
  },

  onBack() {
    wx.navigateBack({ delta: 1 });
  },

  onFillAll() {
    // 原型占位：真实场景会逐个弹输入
    wx.showToast({ title: "逐项补齐：原型占位", icon: "none" });
  },

  onGenerate() {
    const now = new Date();
    const pad = (n) => (n < 10 ? "0" + n : "" + n);
    const stamp = pad(now.getMonth() + 1) + "-" + pad(now.getDate()) + " " + pad(now.getHours()) + ":" + pad(now.getMinutes());

    // 归档：生成的文书进"资料"页
    store.addDoc({
      id: "g" + Date.now(),
      kind: this.data.title,
      name: this.data.title + " · " + (this.data.sub || ""),
      meta: stamp,
      state: this.data.missingCount ? "待补 " + this.data.missingCount + " 项" : "待签",
      tone: "wait",
      icon: "doc",
      visual: false,
    });

    try {
      wx.vibrateShort({ type: "heavy" });
    } catch (e) {}
    wx.showToast({ title: "已生成，去「资料」看", icon: "none" });
    setTimeout(() => wx.navigateBack({ delta: 1 }), 900);
  },
});

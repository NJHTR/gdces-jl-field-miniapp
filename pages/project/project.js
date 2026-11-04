const store = require("../../utils/store");

const GROUPS = [
  {
    label: "工程识别",
    rows: [
      { k: "name", t: "工程名称", ph: "云谷智造园 · 3期" },
      { k: "code", t: "工程编号", ph: "备案号 / 内部编号" },
      { k: "addr", t: "工程地址", ph: "区 · 街道 · 门牌" },
      { k: "category", t: "工程类别", ph: "房屋建筑 / 市政 / 装饰" },
    ],
  },
  {
    label: "参建单位",
    rows: [
      { k: "owner", t: "建设单位", ph: "甲方" },
      { k: "builder", t: "施工单位", ph: "总承包" },
      { k: "supervisor", t: "监理单位", ph: "本单位" },
      { k: "design", t: "设计单位", ph: "" },
      { k: "survey", t: "勘察单位", ph: "" },
    ],
  },
  {
    label: "工程规模",
    rows: [
      { k: "area", t: "建筑面积", ph: "㎡", unit: "㎡" },
      { k: "floors", t: "层数", ph: "地上 32 / 地下 3" },
      { k: "structure", t: "结构类型", ph: "框架-剪力墙" },
      { k: "cost", t: "工程造价", ph: "万元", unit: "万元" },
    ],
  },
  {
    label: "工期与许可",
    rows: [
      { k: "start", t: "开工日期", ph: "2026-03-01" },
      { k: "finish", t: "计划竣工", ph: "2028-09-30" },
      { k: "license", t: "施工许可证", ph: "编号" },
      { k: "bureau", t: "监督机构", ph: "质安监督站" },
    ],
  },
  {
    label: "监理人员",
    rows: [
      { k: "chief", t: "总监理工程师", ph: "姓名" },
      { k: "reps", t: "专业监理工程师", ph: "多人用顿号隔开" },
      { k: "contract", t: "监理合同号", ph: "" },
    ],
  },
];

Page({
  data: {
    groups: GROUPS,
    form: {},
    hdrTop: 52,
    dirty: false,
  },

  onLoad() {
    const form = store.project();

    let hdrTop = 60;
    try {
      const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      let top = (info.statusBarHeight || 44) + 48;
      try {
        const menu = wx.getMenuButtonBoundingClientRect();
        if (menu && menu.bottom) top = menu.bottom + 10;
      } catch (e2) {}
      hdrTop = Math.round(top);
    } catch (e) {}

    // 把值摊进每一行，WXML 里就不用写动态键
    const groups = GROUPS.map((g) => ({
      label: g.label,
      rows: g.rows.map((r) => ({ k: r.k, t: r.t, ph: r.ph, v: form[r.k] || "" })),
    }));

    this.setData({ form, hdrTop, groups });
  },

  onBack() {
    if (!this.data.dirty) {
      wx.navigateBack({ delta: 1 });
      return;
    }
    wx.showModal({
      title: "还没保存",
      content: "改动会丢掉，确定返回？",
      confirmText: "丢掉",
      confirmColor: "#d92c20",
      success: (res) => {
        if (res.confirm) wx.navigateBack({ delta: 1 });
      },
    });
  },

  onEdit(e) {
    const gi = Number(e.currentTarget.dataset.gi);
    const ri = Number(e.currentTarget.dataset.ri);
    const k = e.currentTarget.dataset.k;
    const v = e.detail.value;

    const groups = this.data.groups.slice();
    const rows = groups[gi].rows.slice();
    rows[ri] = Object.assign({}, rows[ri], { v });
    groups[gi] = Object.assign({}, groups[gi], { rows });

    const form = Object.assign({}, this.data.form);
    form[k] = v;

    this.setData({ groups, form, dirty: true });
  },

  onSave() {
    store.saveProject(this.data.form);
    try {
      wx.vibrateShort({ type: "heavy" });
    } catch (e) {}
    this.setData({ dirty: false });
    wx.showToast({ title: "已保存", icon: "none" });
    setTimeout(() => wx.navigateBack({ delta: 1 }), 500);
  },
});

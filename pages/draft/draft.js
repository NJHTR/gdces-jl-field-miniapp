const store = require("../../utils/store");
const api = require("../../utils/request");

const DOCS = {
  旁站记录: {
    sub: "3#5F 顶板 · 09:12–10:24",
    bases: [
      {
        ic: "doc", kind: "rec", t: "现场记录 3 条：09:12 开始旁站、10:24 结束、坍落度实测 180mm",
        body:
          "09:12  三号楼五层顶板浇筑旁站，开始。\n" +
          "09:40  坍落度实测 180mm，符合要求。\n" +
          "10:24  浇筑完成，方量待补，试块 2 组。",
      },
      {
        ic: "cam", kind: "photo", t: "现场照片 2 张：浇筑中 1 张、试块取样 1 张",
        img: "/assets/covers/rebar-tie.jpg",
      },
      {
        ic: "search", kind: "rule", t: "规范 GB 50204-2015 §7.3 混凝土浇筑与养护",
        body:
          "7.3.1 混凝土浇筑前，应对模板、支架、钢筋和预埋件进行检查，并作好记录。\n" +
          "7.3.2 混凝土应连续浇筑，当必须间歇时，间歇时间宜缩短，并应在前层混凝土初凝前将次层混凝土浇筑完毕。\n" +
          "7.3.3 混凝土浇筑后，应在 12h 内覆盖并保湿养护。",
      },
      {
        ic: "pen", kind: "memo", t: "你的记忆：旁站结论写「经检查符合要求」", body: "「经检查符合要求」——已使用 23 次，来自你的习惯。",
      },
    ],
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
    bases: [
      {
        ic: "doc", kind: "rec", t: "现场记录 1 条：08:05 发现连墙件缺失 2 处",
        body: "08:05  语音记录：四号楼东侧外架，连墙件少了两根，让整改。\n转写：四号楼东侧外架，连墙件少了两根，让整改。",
      },
      {
        ic: "cam", kind: "photo", t: "现场照片 1 张：4#楼东侧外架缺失部位",
        img: "/assets/covers/doc-review.jpg",
      },
      {
        ic: "search", kind: "rule", t: "规范 JGJ 130-2011 §6.4.3 连墙件设置间距",
        body:
          "6.4.3 连墙件的布置应符合下列规定：\n" +
          "1  宜靠近主节点设置，偏离主节点的距离不应大于 300mm；\n" +
          "2  应从底层第一步纵向水平杆处开始设置；\n" +
          "3  宜优先采用菱形布置，也可采用方形、矩形布置；\n" +
          "4  一字形、开口型脚手架的两端必须设置连墙件。",
      },
      {
        ic: "warn", kind: "rec", t: "历史比对：10-28 同部位曾因连墙件被下过通知单",
        body: "10-28  监理通知单 NO-014：4#楼东侧外架连墙件缺失 3 处，限期 3 天整改。\n11-01  复查：已补齐。\n11-01  本次再次发现缺失 2 处（同一部位重复发生）。",
      },
      {
        ic: "pen", kind: "memo", t: "你的记忆：隐患描述要带部位和数量", body: "「隐患描述要带部位和数量」——已使用 11 次，来自你的习惯。",
      },
    ],
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
    bases: [
      {
        ic: "doc", kind: "rec", t: "当天现场记录 6 条（08:05–17:40）",
        body:
          "08:05  外架连墙件缺失 2 处\n08:40  3#5F 顶板钢筋验收\n09:12  顶板浇筑旁站开始\n10:24  浇筑完成\n15:20  整改照片回传\n17:40  巡查：无异常",
      },
      { ic: "cam", kind: "photo", t: "现场照片 4 张", img: "/assets/covers/concrete-pour.jpg" },
      {
        ic: "warn", kind: "rec", t: "当天开出通知单 1 份（NO-017）",
        body: "NO-017  受检单位：中建八局外架班组\n事由：4#楼东侧外架连墙件缺失 2 处\n状态：未闭环",
      },
      { ic: "pen", kind: "memo", t: "你的记忆：日报先写部位、再写问题", body: "「日报先写部位、再写问题」——已使用 8 次，来自你的习惯。" },
    ],
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
    bases: [],
    basesOpen: false,
    viewerOpen: false,
    viewerTitle: "",
    viewerBody: "",
    missingCount: 0,
    docId: "",
    state: "",
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
    const docId = opt.id || "";

    // 有文书 id 就查真数据；没有（比如从记录点进来）才用原型数据
    if (docId) {
      this._loadDoc(docId, kind);
      return;
    }

    const conf = DOCS[kind] || DOCS["旁站记录"];

    let missing = 0;
    conf.groups.forEach((g) => g.rows.forEach((r) => r.missing && missing++));

    this.setData({
      bases: conf.bases || [],
      basesOpen: false,
      title: kind,
      sub: decodeURIComponent(opt.obj || "") || conf.sub,
      groups: conf.groups,
      missingCount: missing,
    });
  },

  /**
   * 读真文书。
   *
   * 字段是后端给的 key-value（中文键名），待补是 missing 数组，
   * 依据是 [{ref, kind, text}]。这里只做"摆到页面上"，
   * 不去猜字段含义 —— 猜错了比不显示更糟。
   */
  _loadDoc(docId, kind) {
    api
      .get("/api/v1/docs/" + docId)
      .then((d) => {
        const fields = d.fields || {};
        const missing = d.missing || [];

        const filled = Object.keys(fields)
          .filter((k) => String(fields[k] == null ? "" : fields[k]).trim())
          .map((k) => ({ k: k, v: String(fields[k]) }));

        const groups = [];
        if (filled.length) groups.push({ label: "基本信息", rows: filled });
        if (missing.length) {
          groups.push({
            label: "待补",
            rows: missing.map((k) => ({ k: k, v: "", missing: true })),
          });
        }

        // 依据：规范类显示「标准名 第 X 条」，点开看原文摘录；照片类显示能看大图
        const bases = (d.bases || []).map((b) => {
          const isRule = (b.kind || "rule") === "rule";
          let t = b.ref || b.kind || "依据";
          if (isRule && b.std && b.clause) t = b.std + " 第 " + b.clause + " 条";
          else if (isRule && b.clause) t = (b.ref || "").split("#")[0] + " 第 " + b.clause + " 条";
          return {
            ic: b.kind === "photo" ? "cam" : "search",
            kind: b.kind || "rule",
            t: t,
            body: b.quote || b.text || "",
          };
        });

        this.setData({
          docId: d.id || docId,
          title: d.kind || kind,
          sub: [d.obj, d.state].filter(Boolean).join(" · "),
          state: d.state || "",
          groups: groups,
          bases: bases,
          basesOpen: false,
          missingCount: missing.length,
        });
      })
      .catch((err) => {
        wx.showToast({
          title: "文书没读出来：" + ((err && err.message) || "网络异常"),
          icon: "none",
          duration: 2000,
        });
      });
  },

  onBack() {
    wx.navigateBack({ delta: 1 });
  },

  onFillAll() {
    // 找第一个缺项，直接弹输入框补它
    const groups = this.data.groups || [];
    for (let gi = 0; gi < groups.length; gi++) {
      const rows = groups[gi].rows || [];
      for (let ri = 0; ri < rows.length; ri++) {
        if (rows[ri].missing) {
          this._editField(rows[ri].k, "");
          return;
        }
      }
    }
    wx.showToast({ title: "没有缺项了", icon: "none" });
  },

  /** 点某一行字段 → 弹输入框 → 保存 */
  onEditField(e) {
    const k = (e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.k) || "";
    if (!k) return;
    let cur = "";
    (this.data.groups || []).forEach((g) => {
      (g.rows || []).forEach((r) => {
        if (r.k === k) cur = r.v || "";
      });
    });
    this._editField(k, cur);
  },

  _editField(key, value) {
    const that = this;
    wx.showModal({
      title: key,
      editable: true,
      placeholderText: "填「" + key + "」",
      content: value || "",
      success(res) {
        if (!res.confirm) return;
        const v = String(res.content == null ? "" : res.content).trim();
        if (!v) {
          wx.showToast({ title: "没填内容", icon: "none" });
          return;
        }
        that._saveField(key, v);
      },
    });
  },

  /** 保存一个字段：PUT /docs/<id>（小程序不支持 PATCH，服务端已支持 PUT） */
  _saveField(key, value) {
    const id = this.data.docId;
    if (!id) return;
    const fields = {};
    fields[key] = value;
    api
      .put("/api/v1/docs/" + id, { fields: fields })
      .then((d) => {
        wx.showToast({ title: "已保存", icon: "none", duration: 900 });
        const missing = (d && d.missing) || [];
        this.setData({ missingCount: missing.length, state: (d && d.state) || this.data.state });
        this._loadDoc(id, this.data.title);
      })
      .catch((err) => {
        let msg = (err && err.message) || "保存失败";
        const dropped = err && err.dropped;
        if (dropped && dropped.length) msg = "这几种字段不收：" + dropped.join("、");
        wx.showToast({ title: msg, icon: "none", duration: 2200 });
      });
  },

  /** 点依据 → 看原文（照片直接看大图） */
  onBasisTap(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    const b = this.data.bases[idx];
    if (!b) return;
    try {
      wx.vibrateShort({ type: "light" });
    } catch (err) {}

    if (b.kind === "photo" && b.img) {
      wx.previewImage({ current: b.img, urls: [b.img] });
      return;
    }

    this.setData({
      viewerOpen: true,
      viewerTitle: b.kind === "rule" ? "规范原文" : b.kind === "memo" ? "你的记忆" : "原始记录",
      viewerBody: b.body || b.t,
    });
  },

  /** 占位：阻止点击穿透到遮罩 */
  noop() {},

  onViewerClose() {
    this.setData({ viewerOpen: false });
  },

  onToggleBases() {
    this.setData({ basesOpen: !this.data.basesOpen });
  },

  onGenerate() {
    const id = this.data.docId;
    const left = this.data.missingCount || 0;

    if (!id) {
      wx.showToast({ title: "这份文书还没入库", icon: "none" });
      return;
    }
    if (left) {
      wx.showToast({ title: "还缺 " + left + " 项", icon: "none", duration: 1500 });
      this.onFillAll();
      return;
    }

    const that = this;
    api
      .put("/api/v1/docs/" + id, { state: "待签" })
      .then(() => {
        wx.showToast({ title: "已生成，待签发", icon: "none", duration: 1200 });
        that._loadDoc(id, that.data.title);
        setTimeout(() => wx.navigateBack({ delta: 1 }), 1200);
      })
      .catch((err) => {
        // 缺项被拒时，服务端会带回 missing
        const miss = (err && err.missing) || [];
        const msg = miss.length ? "还缺 " + miss.length + " 项：" + miss.join("、") : ((err && err.message) || "生成失败");
        wx.showToast({ title: msg, icon: "none", duration: 2400 });
      });
  },
});

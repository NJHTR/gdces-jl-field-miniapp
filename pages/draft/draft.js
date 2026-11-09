const store = require("../../utils/store");
const api = require("../../utils/request");
const uploader = require("../../utils/upload");
const { API_BASE } = require("../../utils/config");

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
    docFile: { exists: false },
    fieldSheet: { open: false, key: "", type: "text", value: "" },
    viewerOpen: false,
    viewerTitle: "",
    viewerBody: "",
    missingCount: 0,
    docId: "",
    state: "",
    hdrTop: 52,
    bottomPad: 48,
    kbHeight: 0,
  },

  onLoad(options) {
    const opt = options || {};
    // 补充面板是 fixed 底部卡片；键盘弹出时手动把卡片抬起来，
    // 否则输入“实测值”这类长文本会被键盘遮住。
    this._onKb = (res) => {
      this.setData({ kbHeight: Math.max(0, (res && res.height) || 0) });
    };
    try {
      wx.onKeyboardHeightChange(this._onKb);
    } catch (e) {}

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
      this._routeDocId = String(docId);
      // 先把 id 落到 data：详情还在请求时用户点“提交待签”，
      // 不能因为 data.docId 还是空就误报“这份文书还没入库”。
      this.setData({ docId: String(docId) });
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

        const PLACEHOLDERS = ["待补", "待定", "待填写", "待确认", "未知", "不详", "N/A", "n/a", "/", "-"];
        const filled = Object.keys(fields)
          .filter((k) => {
            const v = String(fields[k] == null ? "" : fields[k]).trim();
            // 值为“待补”的旧字段不要当成已填内容再显示一行；
            // 真正的必填缺项在 missing 里，会显示成可点击的待补行。
            return v && PLACEHOLDERS.indexOf(v) < 0;
          })
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
        // 老文书可能把 bases 存成字符串（"GB 50204-2015 第 8.2.1 条"），
        // 也可能只存 ref 不存 quote；这里统一归一，点开时再按 code/clause 补原文。
        const bases = (d.bases || []).map((b) => {
          if (typeof b === "string") {
            const ref = b.trim();
            const m = ref.replace(/^standard:\/\//, "").match(
              /((?:GB\/T|GB|JGJ\/T|JGJ|JG|DBJ|CJJ|CECS)[\s/]*[\d.]+(?:-\s*\d{4})?)\s*(?:#|第)\s*([\d.]+)/i
            );
            return {
              ic: "search",
              kind: "rule",
              t: ref || "依据",
              body: "",
              ref: ref,
              code: m ? m[1].replace(/\s+/g, " ").trim() : "",
              clause: m ? m[2] : "",
            };
          }
          const isRule = (b.kind || "rule") === "rule";
          const isPhoto = b.kind === "photo";
          const ref = String(b.ref || "");
          let code = b.code || "";
          let clause = b.clause || "";
          const m = ref.replace(/^standard:\/\//, "").match(/^(.+?)#([^#]+)$/);
          if (!code && m) {
            code = m[1].replace(/\s+/g, " ").trim();
            clause = m[2];
          }
          let t = (isPhoto && b.text) || ref || b.kind || "依据";
          if (isRule && b.std && clause) t = b.std + " 第 " + clause + " 条";
          else if (isRule && clause) t = (ref.split("#")[0] || "规范") + " 第 " + clause + " 条";
          return {
            ic: isPhoto ? "cam" : "search",
            kind: b.kind || "rule",
            t: t,
            body: b.quote || b.text || "",
            img: isPhoto && ref ? API_BASE + "/api/v1/blobs/" + ref : "",
            ref: ref,
            code: code,
            clause: clause,
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
          docFile: d.file || { exists: false },
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

  onUnload() {
    try {
      if (this._onKb) wx.offKeyboardHeightChange(this._onKb);
    } catch (e) {}
  },

  onFillAll() {
    // 找第一个缺项，直接打开对应的控件补它
    const groups = this.data.groups || [];
    for (let gi = 0; gi < groups.length; gi++) {
      const rows = groups[gi].rows || [];
      for (let ri = 0; ri < rows.length; ri++) {
        if (rows[ri].missing) {
          this._openField(rows[ri].k, "");
          return;
        }
      }
    }
    wx.showToast({ title: "没有缺项了", icon: "none" });
  },

  /** 点某一行字段 → 按字段类型打开日期/时间/文字/附件控件 */
  onEditField(e) {
    const k = (e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.k) || "";
    if (!k) return;
    let cur = "";
    (this.data.groups || []).forEach((g) => {
      (g.rows || []).forEach((r) => {
        if (r.k === k) cur = r.v || "";
      });
    });
    this._openField(k, cur);
  },

  _fieldType(key) {
    const k = String(key || "");
    if (/(附件|照片|影像)/.test(k)) return "photo";
    if (/日期/.test(k)) return "date";
    if (/时间/.test(k)) return "time";
    return "text";
  },

  _openField(key, value) {
    const type = this._fieldType(key);
    let v = String(value || "");
    if (type === "date" && !v) {
      const d = new Date();
      const pad = (n) => (n < 10 ? "0" + n : "" + n);
      v = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
    }
    if (type === "time" && !v) v = "09:00";
    this.setData({
      fieldSheet: { open: true, key: key, type: type, value: v },
    });
  },

  onFieldInput(e) {
    this.setData({ "fieldSheet.value": e.detail.value || "" });
  },

  onFieldDate(e) {
    this.setData({ "fieldSheet.value": e.detail.value || "" });
  },

  onFieldTime(e) {
    this.setData({ "fieldSheet.value": e.detail.value || "" });
  },

  onFieldClose() {
    try { wx.hideKeyboard(); } catch (e) {}
    this.setData({ fieldSheet: { open: false, key: "", type: "text", value: "" }, kbHeight: 0 });
  },

  onFieldSave() {
    const f = this.data.fieldSheet || {};
    const v = String(f.value || "").trim();
    if (!v) {
      wx.showToast({ title: "还没填内容", icon: "none" });
      return;
    }
    this.onFieldClose();
    this._saveField(f.key, v);
  },

  onFieldPhoto(e) {
    const source = (e.currentTarget.dataset.source || "album") === "camera" ? "camera" : "album";
    const that = this;
    wx.chooseMedia({
      count: 1,
      mediaType: ["image"],
      sourceType: [source],
      success(res) {
        const f = (res.tempFiles || [])[0];
        if (f && f.tempFilePath) that._attachPhoto(f.tempFilePath);
      },
    });
  },

  /** 不依赖某个字段，直接给这份文书补充现场附件 */
  onAddAttachment() {
    const that = this;
    wx.chooseMedia({
      count: 1,
      mediaType: ["image"],
      sourceType: ["camera", "album"],
      success(res) {
        const f = (res.tempFiles || [])[0];
        if (f && f.tempFilePath) that._attachPhoto(f.tempFilePath);
      },
    });
  },

  _attachPhoto(path) {
    const id = this.data.docId || this._routeDocId;
    if (!id) {
      wx.showToast({ title: "这条记录还没加载到编号", icon: "none" });
      return;
    }
    wx.showLoading({ title: "上传附件…", mask: true });
    uploader
      .uploadFile(path, "photo", { note: "文书补充附件" })
      .then((r) =>
        api.put("/api/v1/docs/" + id, {
          bases: [{ kind: "photo", ref: r.sha || "", text: "现场补充附件" }],
        })
      )
      .then(() => {
        wx.hideLoading();
        this.onFieldClose();
        wx.showToast({ title: "附件已补充", icon: "none" });
        this._loadDoc(id, this.data.title);
      })
      .catch((err) => {
        wx.hideLoading();
        wx.showToast({ title: (err && err.message) || "附件上传失败", icon: "none" });
      });
  },

  /** 保存一个字段：PUT /docs/<id>（小程序不支持 PATCH，服务端已支持 PUT） */
  _saveField(key, value) {
    const id = this.data.docId || this._routeDocId;
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

    // 老文书只存了条号，原文不在 bases 里：点开时按 code/clause 现取
    if (b.kind === "rule" && !b.body && b.code && b.clause) {
      this.setData({
        viewerOpen: true,
        viewerTitle: "规范原文",
        viewerBody: "正在取原文…",
      });
      api
        .get("/api/v1/standard?code=" + encodeURIComponent(b.code) +
             "&clause=" + encodeURIComponent(b.clause))
        .then((d) => {
          this.setData({
            viewerTitle: (b.code || "规范") + " 第 " + b.clause + " 条" +
                         (d && d.title ? " · " + d.title : ""),
            viewerBody: (d && d.body) || "规范库里没有这条原文",
          });
        })
        .catch(() => {
          this.setData({ viewerBody: "原文取不到：规范库里没有这条，或网络异常" });
        });
      return;
    }

    this.setData({
      viewerOpen: true,
      viewerTitle: b.kind === "rule" ? "规范原文" : b.kind === "memo" ? "你的记忆" : "原始记录",
      viewerBody: b.body || (b.kind === "rule"
        ? "这条依据只存了条号，没有原文：" + (b.t || "")
        : b.t || "没有内容"),
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
    const id = this.data.docId || this._routeDocId;
    const left = this.data.missingCount || 0;

    if (!id) {
      wx.showToast({ title: "这条记录还没加载到编号，请回记录列表重新打开", icon: "none", duration: 2200 });
      return;
    }
    if (left) {
      wx.showToast({ title: "还缺 " + left + " 项", icon: "none", duration: 1500 });
      this.onFillAll();
      return;
    }
    if (this.data.state === "待签") {
      wx.showToast({ title: "已经是待签状态，可直接生成 Word 文件", icon: "none", duration: 1800 });
      return;
    }

    const that = this;
    api
      .put("/api/v1/docs/" + id, { state: "待签" })
      .then(() => {
        // 不要自动退回聊天：否则用户会觉得“东西提交完就消失了”。
        // 停在详情页，让状态、文件入口和下一步都看得见。
        try {
          wx.setStorageSync("jl_doc_state", { id: String(id), state: "待签", at: Date.now() });
        } catch (e) {}
        that.setData({ state: "待签" });
        wx.showToast({ title: "已提交待签，可继续生成 Word 文件", icon: "none", duration: 2200 });
        that._loadDoc(id, that.data.title);
      })
      .catch((err) => {
        // 缺项被拒时，服务端会带回 missing
        const miss = (err && err.missing) || [];
        const msg = miss.length ? "还缺 " + miss.length + " 项：" + miss.join("、") : ((err && err.message) || "生成失败");
        wx.showToast({ title: msg, icon: "none", duration: 2400 });
      });
  },

  /** 文件卡：已生成且未过期就直接打开，否则重新生成 */
  onFileCardTap() {
    const f = this.data.docFile || {};
    if (f.exists && !f.stale) {
      this._openDocFile(f);
      return;
    }
    this.onExportForm();
  },

  _openDocFile(f) {
    wx.showLoading({ title: "打开文件…", mask: true });
    this._downloadForm(f.url, f.name)
      .then((res) => {
        wx.hideLoading();
        wx.openDocument({
          filePath: res.path,
          fileType: "docx",
          showMenu: true,
          fail: () => wx.showToast({ title: "打不开文档", icon: "none" }),
        });
      })
      .catch((err) => {
        wx.hideLoading();
        wx.showToast({ title: (err && err.message) || "文件打开失败", icon: "none" });
      });
  },

  /** 按省统表模板生成 Word：记录详情页直接导出 */
  onExportForm() {
    const id = this.data.docId || this._routeDocId;
    if (!id) {
      wx.showToast({ title: "这条记录还没加载到编号，请回记录列表重新打开", icon: "none", duration: 2200 });
      return;
    }
    wx.showLoading({ title: "生成文件…", mask: true });
    api
      .post("/api/v1/reports/form", {
        projectId: store.project().id,
        docId: Number(id),
      })
      .then((d) => {
        if (!d || !d.url) throw new Error("没有拿到文件地址");
        return this._downloadForm(d.url, d.name);
      })
      .then((f) => {
        wx.hideLoading();
        // 生成后刷新“文件”卡，下一次进来可以直接打开
        this._loadDoc(id, this.data.title);
        wx.openDocument({
          filePath: f.path,
          fileType: "docx",
          showMenu: true,
          fail: () => wx.showToast({ title: "打不开文档", icon: "none" }),
        });
      })
      .catch((err) => {
        wx.hideLoading();
        wx.showToast({
          title: (err && (err.message || err.errMsg)) || "导出失败",
          icon: "none",
          duration: 2600,
        });
      });
  },

  _downloadForm(url, name) {
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
          resolve({ path: res.tempFilePath, name: name || "表格.docx" });
        },
        fail: (err) => reject(new Error((err && err.errMsg) || "下载失败")),
      });
    });
  },
});

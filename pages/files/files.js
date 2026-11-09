const api = require("../../utils/request");
const store = require("../../utils/store");
const { API_BASE } = require("../../utils/config");

const TABS = [
  { k: "docs", t: "文书" },
  { k: "photos", t: "影像" },
  { k: "files", t: "文件" },
  { k: "about", t: "概况" },
];

const META_LABELS = {
  name: "工程名称",
  code: "工程编号",
  addr: "工程地址",
  category: "工程类别",
  owner: "建设单位",
  builder: "施工单位",
  supervisor: "监理单位",
  design: "设计单位",
  survey: "勘察单位",
  area: "建筑面积",
  floors: "层数",
  structure: "结构类型",
  cost: "工程造价",
  start: "开工日期",
  finish: "计划竣工",
  license: "施工许可证",
  bureau: "监督机构",
  chief: "总监理工程师",
  reps: "专业监理工程师",
  contract: "监理合同号",
};

function dayLabel(v) {
  const s = String(v || "").slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return s || "";
  return Number(m[2]) + "月" + Number(m[3]) + "日";
}

function fileSize(n) {
  const bytes = Number(n) || 0;
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + " MB";
  if (bytes >= 1024) return Math.round(bytes / 1024) + " KB";
  return bytes + " B";
}

Page({
  data: {
    hdrTop: 60,
    tab: "docs",
    tabs: TABS,
    projectId: "",
    project: {},
    docs: [],
    photos: [],
    files: [],
    infoRows: [],
    loading: true,
    error: "",
  },

  onLoad(options) {
    let hdrTop = 60;
    try {
      const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      let top = (info.statusBarHeight || 44) + 48;
      try {
        const menu = wx.getMenuButtonBoundingClientRect();
        if (menu && menu.bottom) top = menu.bottom + 10;
      } catch (e) {}
      hdrTop = Math.round(top);
    } catch (e) {}

    const pid = (options && options.projectId) || (store.project() || {}).id || "";
    this.setData({ hdrTop, projectId: pid });
    this.load();
  },

  load() {
    const pid = this.data.projectId;
    if (!pid) {
      this.setData({ loading: false, error: "还没有选择项目" });
      return;
    }
    this.setData({ loading: true, error: "" });
    api
      .get("/api/v1/project/files?projectId=" + encodeURIComponent(pid))
      .then((d) => {
        const project = (d && d.project) || {};
        let meta = project.meta;
        if (typeof meta === "string") {
          try { meta = JSON.parse(meta); } catch (e) { meta = {}; }
        }
        if (!meta || typeof meta !== "object") meta = {};
        const merged = Object.assign({}, meta, {
          name: project.name || meta.name || "",
          code: project.code || meta.code || "",
          addr: project.addr || meta.addr || "",
        });
        const infoRows = [];
        Object.keys(META_LABELS).forEach((k) => {
          const v = merged[k];
          if (v !== undefined && v !== null && String(v).trim()) {
            infoRows.push({ k: k, label: META_LABELS[k], value: String(v).trim() });
          }
        });

        const docs = ((d && d.docs) || []).map((x) => ({
          id: x.id,
          kind: x.kind || "文书",
          obj: x.obj || "",
          state: x.state || "",
          date: dayLabel(x.created_at),
          name: (x.kind || "文书") + (x.obj ? " · " + x.obj : ""),
        }));

        const photos = ((d && d.photos) || []).map((x) => {
          const u = x.url || "";
          const full = /^https?:\/\//.test(u) ? u : API_BASE + u;
          return {
            id: x.id,
            sha: x.sha256,
            url: full,
            thumb: full,
            date: dayLabel(x.shot_at || x.created_at),
            place: x.place || "",
            caption: x.caption || "",
          };
        });

        const files = ((d && d.exports) || []).map((x) => {
          const u = x.url || "";
          return {
            id: (x.docId || "") + "-" + (x.version || "") + "-" + (x.generatedAt || ""),
            url: /^https?:\/\//.test(u) ? u : API_BASE + u,
            name: x.name || "导出文件",
            docName:
              (x.docKind || "文书") + (x.docObj ? " · " + x.docObj : ""),
            version: x.version || 1,
            date: x.generatedAt || "",
            size: fileSize(x.bytes),
          };
        });

        this.setData({
          project,
          docs,
          photos,
          files,
          infoRows,
          loading: false,
          error: "",
        });
      })
      .catch((err) => {
        this.setData({
          loading: false,
          error: (err && err.message) || "项目资料没读出来",
        });
      });
  },

  onBack() {
    wx.navigateBack({ delta: 1 });
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === this.data.tab) return;
    try { wx.vibrateShort({ type: "light" }); } catch (err) {}
    this.setData({ tab: tab });
  },

  onDocTap(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    const d = this.data.docs[idx];
    if (!d) return;
    wx.navigateTo({
      url: "/pages/draft/draft?kind=" + encodeURIComponent(d.kind) +
           "&obj=" + encodeURIComponent(d.obj) +
           (d.id ? "&id=" + encodeURIComponent(d.id) : ""),
    });
  },

  onPhotoTap(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    const p = this.data.photos[idx];
    if (!p) return;
    const urls = this.data.photos.map((x) => x.url).filter(Boolean);
    wx.previewImage({ current: p.url, urls: urls.length ? urls : [p.url] });
  },

  onFileTap(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    const f = this.data.files[idx];
    if (!f) return;
    const token = wx.getStorageSync("token") || "";
    wx.showLoading({ title: "打开文件…", mask: true });
    wx.downloadFile({
      url: f.url,
      header: token ? { authorization: "Bearer " + token } : {},
      timeout: 60000,
      success: (res) => {
        wx.hideLoading();
        if (res.statusCode !== 200) {
          wx.showToast({ title: "文件下载失败", icon: "none" });
          return;
        }
        wx.openDocument({
          filePath: res.tempFilePath,
          fileType: "docx",
          showMenu: true,
          fail: () => wx.showToast({ title: "打不开文档", icon: "none" }),
        });
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: "文件下载失败", icon: "none" });
      },
    });
  },

  onEditProject() {
    wx.navigateTo({ url: "/pages/project/project" });
  },
});

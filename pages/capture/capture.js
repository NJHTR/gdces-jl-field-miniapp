const store = require("../../utils/store");
const geo = require("../../utils/geo");
const uploader = require("../../utils/upload");
const offline = require("../../utils/offline");

/**
 * 现场拍照：取景即带水印（cover-view 盖在 camera 上），
 * 快门后把同一版式用 canvas 画进图里。
 *
 * 定位是一条梯子：自动定位 → 重试 → 地图选点 → 项目地址，
 * 每一级都在水印上看得见，不假装是现场定位。
 */
Page({
  data: {
    src: "",
    wm: {},
    hdrTop: 52,
    saving: false,
    camFailed: false,
    pending: 0,
    userName: "",
    showCam: true,
    chatMode: false,
    locState: "idle", // idle | loading | ok | fail
    locNote: "",
    locSource: "gps", // gps | map | project
    sheet: "", // "" | "edit"
    edit: { place: "", work: "", note: "", shooter: "" },
  },

  onLoad(options) {
    this._chatMode = !!(options && options.mode === "chat");
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

    const app = getApp();
    const u = (app.globalData && app.globalData.user) || {};
    this.setData({
      hdrTop,
      wm: {},
      chatMode: this._chatMode,
      userName: u.name || "",
      edit: { place: "", work: "", note: "", shooter: u.name || "" },
    });
    this.loadWatermark();
  },

  /* ---------------------------------------------------------------- 水印与定位 */

  /**
   * 取一次水印。
   * opts.loc / opts.addr：地图选点后传进来，避免再定位一次。
   */

  /** 回到取景页：先把本地队列里的照片补传掉 */
  onShow() {
    this.setData({ pending: offline.count() });
    offline.drain((path, kind, meta) =>
      uploader.uploadFile(path, kind, meta).then(() => wx.vibrateShort({ type: "light" }))
    ).then((r) => {
      this.setData({ pending: r.left });
      if (r.ok) wx.showToast({ title: "补传 " + r.ok + " 张", icon: "none" });
    });
  },
  loadWatermark(opts) {
    const o = opts || {};
    if (!o.loc && this.data.locState !== "ok") {
      this.setData({ locState: "loading", locNote: "" });
    }
    return geo.watermark(o).then((wm) => {
      const noLoc = wm.lat === null || wm.lat === undefined;
      wm.user = (this.data.edit.shooter || this.data.userName)
        ? "拍摄人 " + (this.data.edit.shooter || this.data.userName)
        : "";
      wm.placeName = this.data.edit.place || "";
      wm.work = this.data.edit.work || "";
      wm.note = this.data.edit.note || "";
      wm.placeTag =
        this.data.locSource === "map"
          ? "（选点）"
          : noLoc
          ? "（项目地址）"
          : "";
      this.setData({
        wm,
        locState: noLoc ? "fail" : "ok",
        locNote: noLoc ? "没拿到定位，现在用的是项目地址" : "",
      });
      return wm;
    });
  },

  /** 点地址行 → 三选一（原生菜单，能盖在相机上） */
  onLocTap() {
    wx.showActionSheet({
      itemList: ["重新定位", "地图选择位置", "使用项目地址"],
      success: (r) => {
        if (r.tapIndex === 0) {
          this.setData({ locSource: "gps" });
          this.loadWatermark();
        } else if (r.tapIndex === 1) {
          this.chooseOnMap();
        } else {
          this.setData({ locSource: "project" });
          this.loadWatermark({ loc: null, addr: store.project().addr || "" });
        }
      },
    });
  },

  /** 地图选点：微信原生地图，可拖拽/搜索 */
  chooseOnMap() {
    const loc = this._loc;
    wx.chooseLocation({
      latitude: loc ? loc.lat : undefined,
      longitude: loc ? loc.lng : undefined,
      success: (res) => {
        if (!res || (!res.latitude && !res.longitude)) return;
        this._loc = { lat: res.latitude, lng: res.longitude };
        this.setData({ locSource: "map" });
        this.loadWatermark({
          loc: this._loc,
          addr: res.address || res.name || "",
        });
      },
      fail: (err) => {
        const msg = (err && err.errMsg) || "";
        if (msg.indexOf("cancel") >= 0) return;
        // 常见：没声明 chooseLocation / 用户拒绝 / 后台未配隐私指引
        wx.showModal({
          title: "选不了位置",
          content: "地图选点需要位置权限。可以在设置里打开，或改用项目地址。",
          confirmText: "去设置",
          success: (r) => {
            if (r.confirm) wx.openSetting({});
          },
        });
      },
    });
  },

  /** 点天气 → 只重取天气 */
  onWeatherTap() {
    const loc = this._loc;
    geo.weather(loc).then((w) => {
      if (!w || (w.temp === null && !w.text)) {
        wx.showToast({ title: "天气取不到", icon: "none" });
        return;
      }
      const wm = Object.assign({}, this.data.wm, {
        weather:
          w.temp === null ? w.text : (w.text ? w.text + " " : "") + w.temp + "℃",
      });
      this.setData({ wm });
    });
  },

  /* ---------------------------------------------------------------- 编辑 */

  onEditTap() {
    // 相机是原生组件，普通 view 盖不上去 → 编辑时先暂停相机
    this.setData({ sheet: "edit", showCam: false });
  },

  onEditInput(e) {
    const k = e.currentTarget.dataset.k;
    const v = e.detail.value;
    this.setData({ ["edit." + k]: v });
  },

  onSheetCancel() {
    this.setData({ sheet: "", showCam: true });
  },

  onSheetSave() {
    const ed = this.data.edit;
    const edited = ["place", "work", "note", "shooter"].filter((k) => (ed[k] || "").trim());
    this._edited = edited;
    this.setData({ sheet: "", showCam: true });
    this.loadWatermark(this._loc ? { loc: this._loc } : undefined);
  },

  /* ---------------------------------------------------------------- 相机 */

  onShoot() {
    if (this.data.sheet) return;
    if (this.data.camFailed) {
      this.onPickSystem();
      return;
    }
    let ctx = null;
    try {
      ctx = wx.createCameraContext();
    } catch (e) {
      this.setData({ camFailed: true });
      return;
    }
    ctx.takePhoto({
      quality: "high",
      success: (res) => {
        this.setData({ src: res.tempImagePath });
        this.loadWatermark(this._loc ? { loc: this._loc } : undefined);
      },
      fail: (err) => {
        const msg = (err && err.errMsg) || "";
        if (msg.indexOf("cancel") >= 0) return;
        wx.showToast({ title: "拍照失败，试试系统相机", icon: "none" });
        this.setData({ camFailed: true });
      },
    });
  },

  onCamErr(e) {
    const msg = (e && e.detail && e.detail.errMsg) || "";
    this.setData({ camFailed: true });
    if (msg.indexOf("auth") >= 0 || msg.indexOf("deny") >= 0) {
      wx.showModal({
        title: "需要相机权限",
        content: "拍照要记录时间地点，请允许访问相机。",
        confirmText: "去设置",
        success: (r) => {
          if (r.confirm) wx.openSetting({});
        },
      });
    }
  },

  onPickSystem() {
    // 不再回退到系统相机：系统相机无法叠加/烧入水印。
    this.setData({ camFailed: false, showCam: true });
    wx.showToast({ title: "请允许相机权限后重试", icon: "none" });
    try {
      wx.openSetting({});
    } catch (e) {}
  },

  onRetake() {
    this.setData({ src: "", showCam: true });
    this.loadWatermark(this._loc ? { loc: this._loc } : undefined);
  },

  onBack() {
    wx.navigateBack({ delta: 1 });
  },

  /* ---------------------------------------------------------------- 合成 */

  compose() {
    return new Promise((resolve) => {
      const src = this.data.src;
      const wm = this.data.wm;

      wx.getImageInfo({
        src,
        success: (info) => {
          const q = wx.createSelectorQuery();
          q.select("#wmc")
            .fields({ node: true, size: true })
            .exec((res) => {
              const canvas = res && res[0] && res[0].node;
              if (!canvas) {
                resolve(src);
                return;
              }
              const W = info.width;
              const H = info.height;
              canvas.width = W;
              canvas.height = H;
              const ctx = canvas.getContext("2d");
              const img = canvas.createImage();
              img.onload = () => {
                try {
                  ctx.drawImage(img, 0, 0, W, H);
                  this.drawWatermark(ctx, W, H, wm);
                  wx.canvasToTempFilePath({
                    canvas,
                    fileType: "jpg",
                    quality: 0.92,
                    success: (r) => resolve(r.tempFilePath || src),
                    fail: () => resolve(src),
                  });
                } catch (e) {
                  resolve(src);
                }
              };
              img.onerror = () => resolve(src);
              img.src = info.path || src;
            });
        },
        fail: () => resolve(src),
      });
    });
  },

  /** 与取景时的 cover-view 版式一一对应 */
  drawWatermark(ctx, W, H, wm) {
    const pad = Math.round(W * 0.045);
    const barW = Math.round(W * 0.085);
    const barH = Math.max(2, Math.round(W * 0.006));
    const fTitle = Math.round(W * 0.052);
    const fBody = Math.round(W * 0.034);
    const fSmall = Math.round(W * 0.028);
    const gap = Math.round(W * 0.022);

    const hasUser = !!wm.user;
    const metaLine = [wm.work ? "工序 " + wm.work : "", wm.placeName || "", wm.note || ""]
      .filter(Boolean)
      .join(" · ");
    const hasMeta = !!metaLine;
    const blockH =
      pad * 2 + barH + gap + fTitle + gap + fBody * 2 +
      (hasMeta ? fSmall + Math.round(fSmall * 0.6) : 0) +
      (hasUser ? fSmall + Math.round(fSmall * 0.6) : 0);
    const top = H - blockH - pad * 0.6;

    const grad = ctx.createLinearGradient(0, top - blockH, 0, H);
    grad.addColorStop(0, "rgba(6,10,16,0)");
    grad.addColorStop(1, "rgba(6,10,16,0.86)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, top - blockH, W, H - top + blockH);

    ctx.fillStyle = "#2b96ff";
    ctx.fillRect(pad, top, barW, barH);

    let y = top + barH + gap + fTitle;
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold " + fTitle + "px sans-serif";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(wm.project || "", pad, y);

    y += gap + fBody;
    ctx.fillStyle = "rgba(255,255,255,0.86)";
    ctx.font = fBody + "px sans-serif";
    ctx.fillText((wm.place || "") + (wm.placeTag || ""), pad, y);

    y += fBody + Math.round(fBody * 0.5);
    const right = wm.time || "";
    ctx.fillStyle = "rgba(255,255,255,0.94)";
    ctx.font = "bold " + fBody + "px sans-serif";
    if (wm.weather) ctx.fillText(wm.weather, pad, y);
    const tw = ctx.measureText(right).width;
    ctx.fillText(right, W - pad - tw, y);

    if (hasMeta) {
      y += fSmall + Math.round(fSmall * 0.6);
      ctx.fillStyle = "rgba(255,255,255,0.82)";
      ctx.font = fSmall + "px sans-serif";
      ctx.fillText(metaLine, pad, y);
    }
    if (hasUser) {
      y += fSmall + Math.round(fSmall * 0.6);
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.font = fSmall + "px sans-serif";
      ctx.fillText(wm.user, pad, y);
    }
  },

  /* ---------------------------------------------------------------- 保存 */

  onSave() {
    if (!this.data.src || this.data.saving) return;
    this.setData({ saving: true });

    const wm = this.data.wm;
    const ed = this.data.edit || {};
    const now = new Date();
    const pad2 = (n) => (n < 10 ? "0" + n : "" + n);
    const shotAt =
      now.getFullYear() + "-" + pad2(now.getMonth() + 1) + "-" + pad2(now.getDate()) +
      " " + pad2(now.getHours()) + ":" + pad2(now.getMinutes()) + ":" + pad2(now.getSeconds());

    this.compose().then((composed) => {
      let saved = composed;
      try {
        saved = wx.getFileSystemManager().saveFileSync(composed);
      } catch (e) {}

      const meta = {
        place: ed.place || wm.place || "",
        work: ed.work || "",
        note: ed.note || "",
        address: wm.place || "",
        addressSource: wm.lat === null || wm.lat === undefined ? "project" : this.data.locSource,
        weather: wm.weather || "",
        weatherSource: wm.weather ? "api" : "none",
        lat: wm.lat,
        lng: wm.lng,
        shotAt,
        deviceTime: shotAt,
        edited: JSON.stringify(this._edited || []),
        capturedBy: this.data.userName || "",
      };

      // 从聊天「+ → 拍照（带水印）」进来：不回填现场影像，直接把水印图作为附件带回。
      if (this._chatMode) {
        try {
          const ch = this.getOpenerEventChannel && this.getOpenerEventChannel();
          if (ch && ch.emit) ch.emit("captured", { src: saved, meta });
        } catch (e) {}
        wx.showToast({ title: "照片已加入附件", icon: "none" });
        setTimeout(() => wx.navigateBack({ delta: 1 }), 400);
        return;
      }

      uploader
        .uploadFile(saved, "photo", meta)
        .then((r) => {
          store.addPhoto({
            id: "p" + Date.now(),
            src: r.url || saved,
            local: saved,
            sha: r.sha || "",
            project: wm.project,
            ...meta,
          });
          try {
            wx.vibrateShort({ type: "heavy" });
          } catch (e) {}
          wx.showToast({ title: "水印已写入 · 存入现场影像", icon: "none" });
          setTimeout(() => wx.navigateBack({ delta: 1 }), 700);
        })
        .catch(() => {
          // 现场断网：先存本地队列，恢复网络自动补传（以前失败=照片直接丢）
          offline.persist(saved).then((path) => {
            const n = offline.enqueue(path, meta);
            this.setData({ pending: n });
            wx.showToast({ title: "已存本地，待网络恢复补传（" + n + " 张）", icon: "none" });
          });
        });
    });
  },
});

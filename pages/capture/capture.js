const store = require("../../utils/store");
const geo = require("../../utils/geo");
const uploader = require("../../utils/upload");

/**
 * 现场拍照：取景时就带水印（cover-view 盖在 camera 上），
 * 按下拍照后把同一版式用 canvas 画进图里。
 *
 * 为什么不用 wx.chooseMedia：它调的是系统相机，页面上看不到水印，
 * 拍完才知道写了什么。水印相机的做法都是「页内 camera + 覆盖层预览」。
 */
Page({
  data: {
    src: "",
    wm: {},
    hdrTop: 52,
    saving: false,
    locHint: "",
    camFailed: false,
    userName: "",
  },

  onLoad() {
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
    this.setData({ hdrTop, wm: {}, userName: u.name || "" });
    this.refreshWatermark();
  },

  onShow() {
    // 从设置页回来（刚给了定位权限）→ 立刻重取一次
    if (this._askedSetting) {
      this._askedSetting = false;
      this.refreshWatermark();
    }
  },

  /* ---------------------------------------------------------------- 水印 */

  /**
   * 定位 → 地址 + 天气。
   * 拿不到定位不阻断：用项目地址，并在屏幕上明说。
   */
  refreshWatermark() {
    return geo.watermark().then((wm) => {
      wm.user = this.data.userName ? "拍摄人 " + this.data.userName : "";
      const noLoc = wm.lat === null || wm.lat === undefined;
      this.setData({
        wm,
        locHint: noLoc ? "没拿到定位（用的是项目地址）· 点此开启" : "",
      });
      return wm;
    });
  },

  /** 点提示 → 去设置开定位 */
  onAskLoc() {
    this._askedSetting = true;
    wx.openSetting({
      success: (r) => {
        if (r && r.authSetting && r.authSetting["scope.userLocation"]) {
          this.refreshWatermark();
        }
      },
      fail: () => wx.showToast({ title: "打开设置失败", icon: "none" }),
    });
  },

  /* ---------------------------------------------------------------- 相机 */

  onShoot() {
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
        // 时间刷新到这一张；其余信息沿用屏幕上看到的（所见即所存）
        this.refreshWatermark();
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

  /** 兜底：系统相机（水印拍完再画） */
  onPickSystem() {
    wx.chooseMedia({
      count: 1,
      mediaType: ["image"],
      sourceType: ["camera"],
      camera: "back",
      sizeType: ["compressed"],
      success: (res) => {
        const f = res.tempFiles && res.tempFiles[0];
        if (!f) return;
        this.setData({ src: f.tempFilePath, camFailed: false });
        this.refreshWatermark();
      },
      fail: (err) => {
        const msg = (err && err.errMsg) || "";
        if (msg.indexOf("cancel") >= 0) return;
        if (msg.indexOf("auth") >= 0 || msg.indexOf("deny") >= 0) {
          wx.showModal({
            title: "需要相机权限",
            content: "拍照要记录时间地点，请允许访问相机。",
            confirmText: "去设置",
            success: (r) => {
              if (r.confirm) wx.openSetting({});
            },
          });
          return;
        }
        wx.showToast({ title: "打不开相机", icon: "none" });
      },
    });
  },

  onRetake() {
    this.setData({ src: "" });
    this.refreshWatermark();
  },

  onBack() {
    wx.navigateBack({ delta: 1 });
  },

  /* ---------------------------------------------------------------- 合成 */

  /**
   * 把水印真正画进图片，导出成新的临时文件。
   * 任何一步失败都退回原图，不阻断保存。
   */
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

  /** 按图片宽度等比排版；与屏幕上 cover-view 的版式一一对应 */
  drawWatermark(ctx, W, H, wm) {
    const pad = Math.round(W * 0.045);
    const barW = Math.round(W * 0.085);
    const barH = Math.max(2, Math.round(W * 0.006));
    const fTitle = Math.round(W * 0.052);
    const fBody = Math.round(W * 0.034);
    const fSmall = Math.round(W * 0.028);
    const gap = Math.round(W * 0.022);

    const hasUser = !!wm.user;
    const blockH = pad * 2 + barH + gap + fTitle + gap + fBody * 2 +
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
    ctx.fillText(wm.place || "", pad, y);

    y += fBody + Math.round(fBody * 0.5);
    const right = wm.time || "";
    ctx.fillStyle = "rgba(255,255,255,0.94)";
    ctx.font = "bold " + fBody + "px sans-serif";
    if (wm.weather) ctx.fillText(wm.weather, pad, y);
    const tw = ctx.measureText(right).width;
    ctx.fillText(right, W - pad - tw, y);

    if (hasUser) {
      y += fSmall + Math.round(fSmall * 0.6);
      ctx.fillStyle = "rgba(255,255,255,0.78)";
      ctx.font = fSmall + "px sans-serif";
      ctx.fillText(wm.user, pad, y);
    }
  },

  /* ---------------------------------------------------------------- 保存 */

  /** 存进现场影像 */
  onSave() {
    if (!this.data.src || this.data.saving) return;
    this.setData({ saving: true });

    const wm = this.data.wm;

    this.compose().then((composed) => {
      // 临时文件会被回收，落盘一份才能长期保存
      let saved = composed;
      try {
        saved = wx.getFileSystemManager().saveFileSync(composed);
      } catch (e) {}

      // 先上传拿远端地址，失败就用本地路径（照片不丢）
      uploader.upload(saved).then((remote) => {
        store.addPhoto({
          id: "p" + Date.now(),
          src: remote || saved,
          local: saved,
          project: wm.project,
          place: wm.place,
          time: wm.time,
          weather: wm.weather,
          lat: wm.lat,
          lng: wm.lng,
        });

        try {
          wx.vibrateShort({ type: "heavy" });
        } catch (e) {}
        wx.showToast({ title: "水印已写入 · 存入现场影像", icon: "none" });
        setTimeout(() => wx.navigateBack({ delta: 1 }), 700);
      });
    });
  },
});

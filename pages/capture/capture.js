const store = require("../../utils/store");
const geo = require("../../utils/geo");
const uploader = require("../../utils/upload");

Page({
  data: {
    src: "",
    wm: {},
    hdrTop: 52,
    saving: false,
    tried: false, // 是否已经尝试过打开相机
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

    this.setData({ hdrTop, wm: {} });
    this.refreshWatermark();
  },

  onReady() {
    // 等页面挂载完再调相机，太早调容易直接失败
    setTimeout(() => this.shoot(), 120);
  },

  /** 调相机；取消留在本页，可以再拍 */
  shoot() {
    this.setData({ tried: true });

    wx.chooseMedia({
      count: 1,
      mediaType: ["image"],
      sourceType: ["camera"],
      camera: "back",
      sizeType: ["compressed"],
      success: (res) => {
        const f = res.tempFiles && res.tempFiles[0];
        if (!f) return;
        this.setData({ src: f.tempFilePath });
        this.refreshWatermark();
      },
      fail: (err) => {
        const msg = (err && err.errMsg) || "";
        // 用户主动取消：什么都不做，停在取景页可以再点
        if (msg.indexOf("cancel") >= 0) return;

        // 没授权：引导去设置
        if (msg.indexOf("auth") >= 0 || msg.indexOf("deny") >= 0) {
          wx.showModal({
            title: "需要相机权限",
            content: "拍照要用水印记录时间地点，请允许访问相机。",
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

  /** 定位 + 天气（失败就用项目地址兜底，不阻断拍照） */
  refreshWatermark() {
    geo.watermark().then((wm) => {
      this.setData({ wm });
      if (wm.lat === null) {
        const last = this.data.locHint;
        if (!last) this.setData({ locHint: "没拿到定位，用的是项目地址" });
      }
    });
  },

  onRetake() {
    this.shoot();
  },

  onBack() {
    wx.navigateBack({ delta: 1 });
  },

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

  /** 按图片宽度等比排版，任何分辨率都不走样 */
  drawWatermark(ctx, W, H, wm) {
    const pad = Math.round(W * 0.045);
    const barW = Math.round(W * 0.085);
    const barH = Math.max(2, Math.round(W * 0.006));
    const fTitle = Math.round(W * 0.052);
    const fBody = Math.round(W * 0.034);
    const gap = Math.round(W * 0.022);

    const blockH = pad * 2 + barH + gap + fTitle + gap + fBody * 2;
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
    ctx.fillText(wm.weather || "", pad, y);
    const tw = ctx.measureText(right).width;
    ctx.fillText(right, W - pad - tw, y);
  },

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

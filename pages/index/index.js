const fb = require("../../utils/feedback");
const store = require("../../utils/store");
const api = require("../../utils/request");
const uploader = require("../../utils/upload");
const seed = require("../../utils/seed");
const md = require("../../utils/md");
const { API_BASE } = require("../../utils/config");


const win = (() => {
  try {
    return wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
  } catch (e) {
    return { windowWidth: 375 };
  }
})();

const R = (rpx) => Math.round((rpx * win.windowWidth) / 750);

const DRAWER_MAX = R(416); // 208px @375
const AXIS_LOCK = R(16); // 8px
const OPEN_RATIO = 0.55;
const SWALLOW_MS = 320;

Page({
  data: {
    tab: "field",
    logged: false,
    userName: "",
    userRole: "",
    userInitial: "李",
    project: { name: "云谷智造园 · 3期", sub: "深湾 · 中建八局" },
    hdrTop: 48,
    hdrRight: 16,
    padX: 20,
    rowW: 335,
    bubbleMax: 275,
    pageTitle: "工作记录",
    pageSub: "按日期 · 全部 · 7 条",
    bottomInset: 0,
    bottomPad: 24,
    drawerMaxPx: DRAWER_MAX,

    /* default | input | expanded | search */
    dockMode: "default",
    // 正在处理的任务：全局状态条用它，不依赖消息列表有没有滚到底
    busy: null,
    fab: "bubble",
    tabSwitch: false,

    query: "",
    searchFocus: false,
    searchHint: "搜索说过的内容",

    /* 镜片 */
    lensX: 0,
    lensW: 0,
    lensAnim: "none",
    lensScale: 1,
    tabbarW: 0,

    /* 抽屉 */
    drawerH: 0,
    drawerOpen: false,
    drawerClosing: false,
    dragging: false,

    /* 录音 */
    recording: false,
    draft: "",          // 兼容旧逻辑，真正的打字内容在 this._draft
    draftSeed: "",      // 只由程序设置：恢复草稿 / 粘贴 / 发送后清空
    hasDraft: false,    // 界面"有没有字"，用它决定发送键
    querySeed: "",      // 搜索框同理
    cancel: false,
    recTime: "0:00",
    recMode: "send",
    imMode: "voice",
    attach: [],
    attachRecording: false,
    recDur: "0:00",
    refreshing: false,
    coach: false,
    hapticOn: true,
    kbHeight: 0,
    tlAnchor: "",
    menuOpen: false,
    menuX: 0,
    menuY: 0,
    menuId: "",
    menuVoice: false,
    quoting: null,
    soundOn: true,
    imFocus: false,
    recBars: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],

    anim: "",

    bars: [14, 24, 34, 20, 30, 16, 26, 36, 18, 28, 12],

    recent: {
      field: ["外架", "连墙件", "旁站", "甲方"],
      inbox: ["通知单", "旁站", "待签", "连墙件"],
      docs: ["图纸", "通知单", "已签", "方案"],
      me: ["结论", "单位", "例会"],
    },

    msgs: [],

    records: [],

    photoCount: 0,
    clipText: "",
    pageState: "loading",   // loading | ready | error
    stickyDate: "",
    stickyWeek: "",
    stickyCount: 0,
    stickyLift: false,
    stickyIdx: 0,
    showToday: false,
    jumpAnchor: "",
    pickDate: "",
    loadErr: "",
    docs: [],

    meSeg: "mine",
    memos: [],
    projMemos: [],
    pendingRules: [],

    /* 拖动过程量 */
    dragX0: 0,
    dragY0: 0,
    dragAxis: "",
    dragH: 0,
    lensBase: 0,
  },

  onLoad() {
    this._debug = true;   // 改成 false 就不打印手势日志

    const now = new Date();
    const pad = (n) => (n < 10 ? "0" + n : "" + n);
    this.setData({
      pickDate: now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate()),
    });
    this._baseDocs = this.data.docs.slice();
    this.loadAll();
    this._bindKeyboard();
    const fbState = fb.load();

    // 恢复上次没发出去的草稿
    try {
      const saved = wx.getStorageSync("jl_draft");
      if (saved) {
        this._draft = saved;
        this.setData({ draft: saved, draftSeed: saved, hasDraft: true });
      }
    } catch (e) {}
    this.setData({ hapticOn: fbState.haptic, soundOn: fbState.sound });
    this.refreshViews("");
    this._loadPhotos();
  },

  /** 只认系统级键盘事件：它一定会在键盘真正收起时发 0 */
  _bindKeyboard() {
    if (this._kbBound) return;
    this._kbBound = true;
    this._onKb = (res) => {
      const allow = this.data.dockMode === "input" || this.data.dockMode === "search";
      const h = allow ? (res.height || 0) : 0;
      if (h !== this.data.kbHeight) this.setData({ kbHeight: h });
      if (this._debug) console.log("[kb] height=", res.height);
    };
    try {
      wx.onKeyboardHeightChange(this._onKb);
    } catch (e) {}
  },

  _unbindKeyboard() {
    if (!this._kbBound) return;
    this._kbBound = false;
    try {
      wx.offKeyboardHeightChange(this._onKb);
    } catch (e) {}
  },

  onHide() {
    this._unbindKeyboard();
    this.setData({ kbHeight: 0 });
  },

  onShow() {
    if (this.data.kbHeight !== 0) this.setData({ kbHeight: 0 });
    // 切走再回来：没跑完的任务继续盯着
    if (!this.data.busy) this._resumeInflight();
    this._bindKeyboard();

    // 回到前台：把还停在"复核中"的消息续上（切后台会中断 setTimeout 链）
    (this.data.msgs || []).forEach((m) => {
      if (m && m.taskId && m.reviewState === "pending") {
        this._pollReview(m.taskId, m.id, 10);
      }
    });

    // 现场影像的真实张数
    const photos = store.photos();
    if (photos.length !== this.data.photoCount) this.setData({ photoCount: photos.length });
    // 从拍照页/别的设备回来：资料页的影像封面重新对一次后端
    this._loadPhotos();

    // 生成的文书并进"资料"
    const gen = store.docs();
    const base = this._baseDocs || this.data.docs;
    if (gen.length || this.data.docs.length !== gen.concat(base).length) {
      this.setData({ docs: gen.concat(base) }, () => this.refreshViews(this.data.query));
    }

    // 项目信息以本地仓为准（编辑后头部/水印都跟着变）
    // 注意要合并而不是替换：原来只塞 name/sub，把 id 丢了，
    // 结果 _projectId() 拿不到 id，胶囊也可能变空。
    const local = store.project() || {};
    const localName = String(local.name || "").trim() || local.code || local.id || "";
    if (localName && (this.data.project.name !== localName || this.data.project.id !== local.id)) {
      this.setData({ project: Object.assign({}, this.data.project, local, { name: localName }) });
    }

    // 登录页返回：之前没数据就重新拉一次
    const app0 = getApp();
    if (app0 && app0.globalData && app0.globalData.token && !this._loadedOnce) {
      this.loadAll();
      return;
    }

    // 每次回到页面都同步登录态（登录页返回后要立刻变）
    const app = getApp();
    const user = (app.globalData && app.globalData.user) || null;
    const logged = !!(app.globalData && app.globalData.token);
    const name = (user && user.name) || "李工";
    this.setData({
      logged,
      userName: name,
      userRole: (user && user.role) || "监理员",
      userInitial: name.slice(0, 1),
    });
  },

  onUnload() {
    this._unbindKeyboard();
  },

  onReady() {
    // 头部顶部内边距 = 状态栏高度 + 4px（原型是 4px，状态栏由系统占位）
    const statusBar = win.statusBarHeight || 44;
    const screenH = win.screenHeight || win.windowHeight || 812;
    const safeBottom = (win.safeArea && win.safeArea.bottom) || screenH;

    // 内容整体下移到微信胶囊下方，不再压缩右侧
    let hdrTop = statusBar + 48;
    try {
      const menu = wx.getMenuButtonBoundingClientRect();
      if (menu && menu.bottom) {
        hdrTop = menu.bottom + 10;
      }
    } catch (e) {}

    // 左右留白按屏宽算（18~28px），并据此算出行宽；滚动条是浮层，额外隐藏
    const padX = Math.max(18, Math.min(28, Math.round(win.windowWidth * 0.053)));
    const rowW = win.windowWidth - padX * 2;

    const inset = Math.max(0, screenH - safeBottom);
    this.setData({
      hdrTop: Math.round(hdrTop),
      hdrRight: 14,
      padX,
      rowW,
      bubbleMax: Math.round(rowW * 0.82),
      bottomInset: inset,
      // 底部留白：至少 24（避开圆角屏的弧），有安全区再加 8 的呼吸
      bottomPad: Math.max(28, inset + 10),
    });
    // 尺寸算完后重算一次气泡宽度
    this.refreshViews(this.data.query);
    this.syncLens(false);
    this.calibrateTabbar();
    this.updateFab();
  },

  /**
   * 镜片落位：完全用公式算，不依赖查询
   * tabbarW = 屏宽 - 左右留白×2 - FAB宽 - 间距
   * tabW    = (tabbarW - gap×3) / 4
   * x       = index × (tabW + gap)
   */
  syncLens(animate) {
    const ids = ["field", "inbox", "docs", "me"];
    const idx = Math.max(0, ids.indexOf(this.data.tab));
    const gap = R(4);
    const padX = this.data.padX || 20;
    const tabbarW = this._tabbarW || win.windowWidth - padX * 2 - R(108) - R(18);
    const tabW = Math.max(0, (tabbarW - gap * 3) / 4);

    // 有实测位置就用实测，没有再用公式
    const cand = this._tabs && this._tabs.length === 4 ? this._tabs[idx] : null;
    const real = cand && cand.width > 10 ? cand : null;
    const x = real ? real.left : idx * (tabW + gap);
    const w = real ? real.width : tabW;

    if (this._debug) console.log("[lens] tab=", this.data.tab, "idx=", idx, "x=", Math.round(x), "w=", Math.round(w), "real=", !!real);
    this.setData({
      tabbarW: Math.round(tabbarW),
      lensX: x,
      lensW: w,
      lensScale: 1,
      lensAnim: animate
        ? "left .46s cubic-bezier(.34,1.56,.64,1), width .46s cubic-bezier(.34,1.56,.64,1)"
        : "none",
    });
  },

  /** 启动时校准一次：量 tabbar 宽度 + 4 个 tab 的真实位置 */
  /**
   * 合并项目信息。
   * 后端可能只回部分字段，本地仓可能只有 id —— 这里保证 name 永远有值，
   * 否则左上角胶囊会变成一个空白方块。
   */
  _mergeProject(remote) {
    const prev = this.data.project || {};
    const merged = Object.assign({}, prev, remote || {});
    const name = String(merged.name || "").trim();
    if (!name) merged.name = merged.code || merged.id || prev.name || "未命名项目";
    return merged;
  },

  /** 首屏数据：走统一请求层，失败可重试 */
  loadAll(pid) {
    const id = pid || this._projectId();
    this.setData({ pageState: "loading", loadErr: "" });

    api
      .get("/api/v1/bootstrap?projectId=" + encodeURIComponent(id))
      .then((d) => {
        this._loadedOnce = true;
        this._baseDocs = (d && d.docs) || [];
        this._maybeCoach();
        this.setData(
          {
            msgs: (d && d.msgs) || [],
            project: this._mergeProject((d && d.project) || {}),
            records: (d && d.records) || [],
            docs: this._baseDocs.slice(),
            memos: (d && d.memos) || [],
            projMemos: (d && d.projMemos) || [],
            pendingRules: (d && d.pendingRules) || [],
            pageState: "ready",
          },
          () => {
            this.refreshViews(this.data.query);
            this._loadPhotos();
          }
        );
      })
      .catch((err) => {
        const msg =
          err && err.code === "UNAUTH"
            ? "登录已失效"
            : err && err.code === "NETWORK"
            ? "网络连不上"
            : (err && err.message) || "加载失败";
        this.setData({ pageState: "error", loadErr: msg });
      });
  },

  /** 首次进来提示一次：左滑 / 上拉 */
  _maybeCoach() {
    try {
      if (wx.getStorageSync("jl_coach")) return;
      wx.setStorageSync("jl_coach", 1);
    } catch (e) {}
    setTimeout(() => this.setData({ coach: true }), 1600);
    clearTimeout(this._coachT);
    this._coachT = setTimeout(() => this.setData({ coach: false }), 8000);
  },

  onCoachClose() {
    fb.tap();
    this.setData({ coach: false });
    clearTimeout(this._coachT);
  },

  /** 下拉刷新：重新拉数据（现在走 mock，接后端后就是真请求） */
  onRefresh() {
    if (this.data.refreshing) return;
    this.setData({ refreshing: true });
    fb.tap();

    api
      // 必须带 projectId：不带的话后端用默认项目，刷新完就串成别的项目了
      .get("/api/v1/bootstrap?projectId=" + encodeURIComponent(this._projectId()))
      .then((d) => {
        this._loadedOnce = true;
        this._baseDocs = (d && d.docs) || [];
        this._maybeCoach();
        this.setData(
          {
            msgs: (d && d.msgs) || [],
            project: Object.assign({}, this.data.project, (d && d.project) || {}),
            records: (d && d.records) || [],
            docs: this._baseDocs.slice(),
            memos: (d && d.memos) || [],
            projMemos: (d && d.projMemos) || [],
            pendingRules: (d && d.pendingRules) || [],
            photoCount: store.photos().length,
            pageState: "ready",
          },
          () => {
            this.refreshViews(this.data.query);
            this.setData({ refreshing: false });
            this._loadPhotos();
          }
        );
      })
      .catch(() => {
        this.setData({ refreshing: false });
        wx.showToast({ title: "刷新失败，稍后再试", icon: "none" });
      });
  },

  /** 失败了点一下重试 */
  onRetry() {
    fb.tap();
    this.loadAll();
  },
  calibrateTabbar() {
    const q = wx.createSelectorQuery();
    q.select(".tabbar").boundingClientRect();
    q.selectAll(".tab").boundingClientRect();
    q.exec((res) => {
      const bar = res && res[0];
      const tabs = res && res[1];
      if (!bar || !bar.width) return;

      if (bar.width > 50) this._tabbarW = bar.width;
      if (tabs && tabs.length === 4) {
        const mapped = tabs.map((t) => ({
          left: t.left - bar.left,
          width: t.width,
          center: t.left - bar.left + t.width / 2,
        }));
        // 校验：宽度合理、位置递增，否则丢弃（Skyline 有时返回 0）
        const ok =
          mapped.every((t) => t.width > 10) &&
          mapped.every((t, i) => i === 0 || t.left > mapped[i - 1].left + 10);
        if (this._debug) console.log("[dock] 校准", JSON.stringify(mapped.map((t) => Math.round(t.left))), "ok=", ok);
        this._tabs = ok ? mapped : null;
      }
      this.syncLens(false);
    });
  },
  /** 兜底：没量到实际位置时，按四等分推算 */
  fallbackTabs() {
    const gap = R(4);
    // 兜底宽度：屏宽 - 左右留白 - FAB - 间距
    const guessed = win.windowWidth - (this.data.padX || 20) * 2 - R(108) - R(18);
    const w = this._tabbarW || this.data.tabbarW || guessed;
    const tabW = (w - gap * 3) / 4;
    return [0, 1, 2, 3].map((i) => {
      const left = i * (tabW + gap);
      return { left, width: tabW, center: left + tabW / 2 };
    });
  },

  /** 松手吸附：找中心最近的 tab（和原型完全一致） */
  snapToNearest(fingerX) {
    const tabs = this._tabs && this._tabs.length === 4 ? this._tabs : this.fallbackTabs();
    const center = fingerX + this.data.lensW / 2;
    let best = 0;
    let bd = Infinity;
    tabs.forEach((t, i) => {
      const d = Math.abs(t.center - center);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });

    const ids = ["field", "inbox", "docs", "me"];
    if (this._debug) console.log("[dock] snap ->", ids[best], "from", this.data.tab, "center=", Math.round(center), "tabs=", JSON.stringify(tabs.map(t => Math.round(t.center))));
    if (ids[best] !== this.data.tab) {
      this.switchTo(ids[best], fingerX < this.data.lensX ? "left" : "right");
    } else {
      this.syncLens(true);
    }
  },

  /* ---------------- 状态机 ---------------- */

  updateFab() {
    const mode = this.data.dockMode;
    let fab = "plus";
    if (mode === "search" || mode === "expanded") fab = "close";
    else if (mode === "input") fab = "down";
    else fab = this.data.tab === "field" ? "bubble" : "plus";
    this.setData({ fab });
  },

  setMode(mode) {
    // 离开输入态前先结束录音，否则状态会卡在录音里
    if (mode !== "input" && this.data.recording) this.onMicEnd();
    this.setData({ dockMode: mode }, () => {
      this.updateFab();
      if (mode === "default") wx.nextTick(() => this.syncLens(true));
      if (mode === "expanded") wx.nextTick(() => this.measureDrawer());
    });
  },

  /** 量出抽屉真实高度（向下拖收起要靠它） */
  measureDrawer() {
    const q = wx.createSelectorQuery();
    q.select(".drawer").boundingClientRect();
    q.exec((res) => {
      const r = res && res[0];
      if (r && r.height > 0 && Math.abs(r.height - this.data.drawerH) > 1) {
        this.setData({ drawerH: Math.round(r.height) });
        if (this._debug) console.log("[drawer] 高度", Math.round(r.height));
      }
    });
  },

  /* ---------------- 底部手势 ---------------- */

  onDockTouchStart(e) {
    if (this.data.dockMode !== "default") return;
    const t = e.touches[0];
    this.setData({
      dragX0: t.clientX,
      dragY0: t.clientY,
      dragAxis: "",
      dragH: 0,
      lensBase: this.data.lensX,
      dragging: true,
    });
    this._vy = 0;
    this._lastY = t.clientY;
    this._lastT = Date.now();
  },

  onDockTouchMove(e) {
    if (!this.data.dragging) return;
    const t = e.touches[0];
    const dx = t.clientX - this.data.dragX0;
    const dy = this.data.dragY0 - t.clientY;

    // 记录速度（px/ms），松手时用于"甩一下也开"
    const now = Date.now();
    if (this._lastY != null && now - this._lastT > 0) {
      this._vy = (this._lastY - t.clientY) / (now - this._lastT);
    }
    this._lastY = t.clientY;
    this._lastT = now;
    let axis = this.data.dragAxis;

    if (!axis) {
      if (Math.abs(dx) < AXIS_LOCK && Math.abs(dy) < AXIS_LOCK) return;
      axis = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
      this.setData({ dragAxis: axis });
    }

    if (axis === "h") {
      const stretch = 1 + Math.min(0.14, Math.abs(dx) / 300);
      this.setData({
        lensX: this.data.lensBase + dx,
        lensAnim: "none",
        lensScale: stretch,
      });
      return;
    }

    let h = dy;
    if (h > DRAWER_MAX) h = DRAWER_MAX + (h - DRAWER_MAX) * 0.22;
    if (h < 0) h = 0;
    this.setData({ dragH: h, drawerH: h });
  },

  onDockTouchEnd(e) {
    if (!this.data.dragging) return;
    const axis = this.data.dragAxis;
    const endX = e.changedTouches[0] ? e.changedTouches[0].clientX : this.data.dragX0;
    const dx = endX - this.data.dragX0;

    if (axis === "h") {
      this.snapToNearestTab(dx);
      return;
    }

    if (axis === "v") {
      const h = this.data.dragH;
      // 位置过半，或者甩得够快（>0.5px/ms）都算展开
      const open = h > DRAWER_MAX * OPEN_RATIO || this._vy > 0.5;
      this._dragEndAt = Date.now();
      this.setData({
        dragging: false,
        dragAxis: "",
        drawerH: open ? DRAWER_MAX : 0,
        drawerOpen: open,
      });
      this.setMode(open ? "expanded" : "default");
      return;
    }

    this.setData({ dragging: false, dragAxis: "" });
  },

  snapToNearestTab(dx) {
    const tabs = ["field", "inbox", "docs", "me"];
    const idx = tabs.indexOf(this.data.tab);
    const step = this.data.lensW || R(150);
    const next = Math.max(0, Math.min(tabs.length - 1, idx + Math.round(dx / step)));

    this.setData({ dragging: false, dragAxis: "", lensScale: 1 });
    this._dragEndAt = Date.now();

    if (next !== idx) {
      this.switchTo(tabs[next], dx < 0 ? "left" : "right");
    } else {
      this.syncLens(true);
    }
  },

  /** 记录手势起点（内层 JS 通道，用于松手吸附） */
  onGestureStart(e) {
    const t = e.touches && e.touches[0];
    if (this._debug) console.log("[dock] start", t && t.clientX, "mode=", this.data.dockMode);
    if (!t) return;
    this._gx0 = t.clientX;
    this._gy0 = t.clientY;
    this._gestureActive = this.data.dockMode === "default" || this.data.dockMode === "expanded";
    this._wasExpanded = this.data.dockMode === "expanded";
  },

  /** 松手：自己算位移并吸附，不依赖 WXS */
  onGestureEnd(e) {
    if (this._debug) console.log("[dock] end", "active=", this._gestureActive, "x0=", this._gx0);
    if (!this._gestureActive || this._gx0 == null) return;
    const t = e.changedTouches && e.changedTouches[0];
    this._gestureActive = false;
    if (!t) return;

    const dx = t.clientX - this._gx0;
    const dy = this._gy0 - t.clientY;
    if (this._debug) console.log("[dock] dx=", Math.round(dx), "dy=", Math.round(dy));
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return; // 只是点了一下

    // 等 WXS 把手写的行内样式清掉，再让 setData 接管，避免闪一下
    wx.nextTick(() => {
      this.onGesture({ axis: Math.abs(dx) > Math.abs(dy) ? "h" : "v", dx, dy });
    });
  },

  /** 手势结束：做一次 setData（吸附 / 开合） */
  onGesture(g) {
    if (this._debug) console.log("[dock] onGesture", g.axis, Math.round(g.dx), Math.round(g.dy));
    const axis = g.axis;
    const dx = g.dx;
    const dy = g.dy;

    if (axis === "h") {
      this._dragEndAt = Date.now();

      // 手指松开时镜片所在的位置（和 WXS 里的计算一致）
      const fingerX = this.data.lensX + dx;
      this.setData({ lensAnim: "none", lensScale: 1, lensX: fingerX }, () => {
        wx.nextTick(() => this.snapToNearest(fingerX));
      });
      return;
    }

    if (axis === "v") {
      this._dragEndAt = Date.now();

      // ① 已经是展开态：向下拖够多就收起，否则弹回
      if (this._wasExpanded) {
        const down = -dy; // 向下为正
        const h = this.data.drawerH || 1;
        if (down > Math.max(60, h * 0.25)) {
          this.collapseDrawer();
        } else {
          this.setData({ drawerOpen: true, drawerH: h });
        }
        return;
      }

      // ② 收起态：向上拖够多就展开
      const open = dy > DRAWER_MAX * 0.55;
      this.setData({ drawerH: 0, drawerOpen: open });
      this.setMode(open ? "expanded" : "default");
      return;
    }

    // 只是点了一下，还原
    this.syncLens(false);
  },

  /* ---------------- tab ---------------- */

  switchTo(tab, dir) {
    if (this.data.recording) this.onMicEnd();   // 切页先结束录音，别让它卡住
    if (this._debug) console.log("[tab] switchTo", this.data.tab, "->", tab);
    const order = ["field", "inbox", "docs", "me"];
    const anim = "in-" + (dir || (order.indexOf(tab) > order.indexOf(this.data.tab) ? "left" : "right"));
    const meta = this.pageMetaOf(tab);
    this.setData(
      {
        tab,
        anim,
        pageTitle: meta.t,
        pageSub: meta.s,
        dockMode: "default",
    // 正在处理的任务：全局状态条用它，不依赖消息列表有没有滚到底
    busy: null,
        drawerH: 0,
        drawerOpen: false,
        query: "",
        searchHint: this.hintOf(tab),
        kbHeight: 0,
      },
      () => {
        this.updateFab();
        this.refreshViews("");
        wx.nextTick(() => this.syncLens(true));
        if (tab === "docs") this._loadPhotos();
      }
    );
    setTimeout(() => this.setData({ anim: "" }), 260);
  },

  switchTab(e) {
    fb.tap();
    // 刚拖动完的 320ms 内忽略点击，避免误切 tab（原型里就是这么防的）
    if (this._dragEndAt && Date.now() - this._dragEndAt < SWALLOW_MS) return;
    const next = e.currentTarget.dataset.tab;
    if (next === this.data.tab) return;
    this.switchTo(next);
  },

  pageMetaOf(tab) {
    const map = {
      inbox: { t: "工作记录", s: "按日期 · 全部 · 7 条" },
      docs: { t: "资料", s: "本周 12 份 · 原件在 A-3-2" },
      me: { t: "我的", s: "AI 记住了什么 · 可逐条删改" },
    };
    return map[tab] || map.inbox;
  },

  hintOf(tab) {
    return {
      field: "搜索说过的内容",
      inbox: "搜索记录、文书、部位",
      docs: "搜索文件名、编号、状态",
      me: "搜索我记住的东西",
    }[tab];
  },

  /* ---------------- 右钮 ---------------- */

  onFab() {
    const mode = this.data.dockMode;
    if (mode === "search") return this.closeSearch();
    if (mode === "expanded") return this.collapseDrawer();
    if (mode === "input") {
      if (this.data.recording) this.onMicEnd();
      return this.setMode("default");
    }

    if (this.data.tab === "field") {
      // 有草稿就直接进文字态，让人看到自己没发出去的东西
      this.setData({ imMode: (this._draft || this.data.draftSeed) ? "text" : "voice" });
      this.setMode("input");
    } else {
      this.setData({ drawerH: DRAWER_MAX, drawerOpen: true });
      this.setMode("expanded");
    }
  },

  collapseDrawer() {
    if (this.data.kbHeight !== 0) this.setData({ kbHeight: 0 });
    // 先播"被吸进右下角"的动画，结束再收起（原型 .2s）
    fb.tap();
    this.setData({ drawerClosing: true });
    setTimeout(() => {
      this.setData({ drawerH: 0, drawerOpen: false, drawerClosing: false });
      this.setMode("default");
    }, 200);
  },

  /* ---------------- 搜索 ---------------- */

  openSearch() {
    this.setData({
      query: "",
      searchFocus: true,
      drawerH: 0,
      drawerOpen: false,
      searchHint: this.hintOf(this.data.tab),
    });
    this.setMode("search");
  },

  closeSearch() {
    this.setData({ kbHeight: 0 });
    this.setData({ query: "", searchFocus: false });
    this.refreshViews("");
    this.setMode("default");
  },

  onQuery(e) {
    const q = e.detail.value;
    this._query = q;
    this.setData({ query: q });
    this.refreshViews(q);
  },

  clearQuery() {
    this._query = "";
    this.setData({ query: "", querySeed: "", searchFocus: true });
    this.refreshViews("");
  },

  onRecent(e) {
    const q = e.currentTarget.dataset.w;
    this.setData({ query: q, searchFocus: true });
    this.refreshViews(q);
  },

  /* ---------------- 数据 ---------------- */

  /** 按字符估算文本宽度（中文 14.5px，西文 7.6px） */
  textWidth(str) {
    let w = 0;
    const s2 = str || "";
    for (let i = 0; i < s2.length; i++) {
      w += /[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/.test(s2[i]) ? 14.5 : 7.6;
    }
    return w;
  },

  /** 气泡宽度：内容宽度 + 左右内边距 28，不超过可用宽度 */
  bubbleWidth(m, max) {
    const textW = Math.max(this.textWidth(m.text), this.textWidth(m.sub));
    // 语音条（波形 + 时长）至少占 110
    const voiceW = m.voice ? 118 : 0;
    return Math.min(max, Math.ceil(Math.max(textW, voiceW)) + 34);
  },

  /** 展开/收起复核意见 */
  onToggleReview(e) {
    const id = (e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.id) || "";
    if (!id) return;
    const map = this._traceOpen || {};
    map[id + ":rv"] = !map[id + ":rv"];
    this._traceOpen = map;
    this.refreshViews(this.data.query);
  },

  refreshViews(raw) {
    const q = (raw || "").trim();
    const hit = (s) => !q || (s || "").indexOf(q) >= 0;
    const bwMax = this.data.bubbleMax || 275;

    const openMap = this._traceOpen || {};
    const itemMap = this._traceItemOpen || {};
    const msgsView = this.data.msgs.map((m) => {
      if (m.type === "stamp") return Object.assign({}, m, { hidden: !!q });
      const text = (m.text || "") + (m.sub || "") + (m.cap || "");
      // 模型会用 Markdown（**加粗**、- 列表、### 小标题），按块渲染，
      // 没有语法就还用原来的纯文本/富文本
      const mdBlocks = m.type === "agent" && md.hasMarkdown(m.text) ? md.parse(m.text) : null;
      return Object.assign({}, m, {
        md: mdBlocks,
        reviewOpen: !!openMap[m.id + ":rv"],
        hidden: !!q && !hit(text),
        bw: m.pending
          ? Math.min(210, bwMax)
          : Math.max(m.artifact ? 282 : 0, this.bubbleWidth(m, bwMax)),
        traceOpen: !!openMap[m.id],
        traceView: (m.trace || []).map(function (t, i) {
          const k = m.id + ":" + i;
          return Object.assign({}, t, { open: !!(itemMap[k]) });
        }),
      });
    });

    const recordsView = this.data.records
      .map((r) =>
        Object.assign({}, r, {
          items: r.items
            .filter((it) => hit(it.kind + it.obj + (it.tags || []).join("")))
            .map((it) => Object.assign({}, it, { cov: it.cov || this.coverOf(it.kind) })),
        })
      )
      .filter((r) => r.items.length);

    // 影像这类"里面本来就有东西"的，用真实照片当封面：
    // 先按 id 对上后端那张（bootstrap 里影像卡 id 是 p+photoId），
    // 对不上退回最新一张（后端优先、本机次之），都没有才用示意图。
    const photos = store.photos();
    const remote = this._remotePhotos || [];
    const remoteById = {};
    remote.forEach((p) => {
      remoteById["p" + p.id] = p.src;
    });
    const latestPhoto = remote.length
      ? remote[0].src
      : photos.length
      ? photos[0].src
      : "";
    const photoTotal = Math.max(remote.length, photos.length);

    const docsView = this.data.docs
      .filter((d) => hit(d.name + d.kind + d.state))
      .map((d) => {
        const cov = d.cov || this.docCoverOf(d.kind, d.name);
        const isPhoto = (d.kind || "").indexOf("影像") >= 0;
        const thumb = remoteById[d.id] || "";
        const img = thumb || (isPhoto && latestPhoto ? latestPhoto : "/assets/covers/" + cov + ".jpg");
        // 后端/示例数据自带 state（已上传 / 12 张）就别覆盖；只有缺的时候才按张数算
        const state = isPhoto
          ? d.state || (photoTotal ? photoTotal + " 张" : "还没有")
          : d.state;
        return Object.assign({}, d, { cov, img, state });
      });
    const _memoMeta = (m) => {
      const src =
        m.source === "learned" ? "自动记的"
        : m.source === "confirmed" ? "你确认的规矩"
        : m.source === "correction" ? "从纠正里来的"
        : "手动记的";
      return src + (m.hits ? " · 用过 " + m.hits + " 次" : " · 还没用过");
    };
    const _deco = (m) =>
      Object.assign({}, m, {
        meta: _memoMeta(m),
        stateText: m.status ? "✓ 生效中" : "已停用",
        active: !!m.status,
      });
    const memosView = this.data.memos.filter((m) => hit(m.text)).map(_deco);

    // 当前页的命中数（搜索时显示在顶部）
    let count = 0;
    if (this.data.tab === "field") count = msgsView.filter((m) => !m.hidden).length;
    else if (this.data.tab === "inbox") count = recordsView.reduce((n, r) => n + r.items.length, 0);
    else if (this.data.tab === "docs") count = docsView.length;
    // 「我的」页有两个分段：空状态和搜索计数要跟当前分段走，
    // 否则切到「项目的」时会拿「我的」的条数，空状态一直挂着
    else
      count =
        this.data.meSeg === "pending"
          ? this.data.pendingRules.length
          : this.data.meSeg === "project"
          ? this.data.projMemos.filter((m) => hit(m.text)).length
          : memosView.length;

    let listEmpty = false;
    let emptyText = "";
    let emptySub = "";
    if (this.data.tab === "field") {
      listEmpty = count === 0;
      emptyText = "还没有今天的记录";
      emptySub = "按住说话，或拍张照片";
    } else if (this.data.tab === "inbox") {
      listEmpty = count === 0;
      emptyText = "还没有文书";
      emptySub = "现场说的话，会自动整理成文书";
    } else if (this.data.tab === "docs") {
      listEmpty = count === 0;
      emptyText = "还没有资料";
      emptySub = "图纸、方案、报验都会收进这里";
    } else if (this.data.meSeg === "pending") {
      listEmpty = count === 0;
      emptyText = "没有待确认的规矩";
      emptySub = "模型提议的规矩会先出现在这里，你点了才生效";
    } else {
      listEmpty = count === 0;
      emptyText = "还没有记忆";
      emptySub = "你改过一次的地方，它就会记住";
    }

    this.setData({
      msgsView,
      recordsView,
      docsView,
      memosView,
      projMemosView: this.data.projMemos.filter((m) => hit(m.text)).map(_deco),
      searchCount: count,
      listEmpty,
      emptyText,
      emptySub,
    });

    if (this.data.tab === "inbox") {
      wx.nextTick(() => this.measureSections());
    }
  },

  /** 我的页抽屉：记忆操作 */
  /**
   * 真写一条记忆：POST → 重新拉列表。
   * 以前这里只改本地数组，弹个「已记住」，刷新就没了（假写）。
   */
  _saveMemo(text, scope) {
    const uid = this._userId();
    const pid = this._projectId();
    const ownerId = scope === "project" ? pid : uid;
    return api
      .post("/api/v1/memories", { scope, ownerId, text, source: "manual" })
      .then(() =>
        api.get(
          "/api/v1/memories?scope=" +
            scope +
            "&ownerId=" +
            encodeURIComponent(ownerId)
        )
      )
      .then((rows) => {
        const list = (rows || []).map((m) => ({
          id: (scope === "project" ? "p" : "m") + m.id,
          text: m.text,
          meta:
            (m.source === "learned" ? "自动记的" : "手动添加") +
            (m.hits ? " · 用过 " + m.hits + " 次" : ""),
        }));
        this.setData(
          scope === "project" ? { projMemos: list } : { memos: list },
          () => this.refreshViews(this.data.query)
        );
        wx.showToast({ title: "已记住", icon: "none" });
      })
      .catch((err) => {
        wx.showToast({
          title: "没记住：" + ((err && err.message) || "网络问题"),
          icon: "none",
        });
      });
  },

  onMemoAction(e) {
    const act = e.currentTarget.dataset.act;

    if (act === "write") {
      wx.showModal({
        title: "写一条记忆",
        editable: true,
        placeholderText: "例如：整改回复必须附整改前后对比图",
        success: (res) => {
          const text = (res.content || "").trim();
          if (!res.confirm || !text) return;
          this.collapseDrawer();
          const scope = this.data.meSeg === "project" ? "project" : "user";
          this._saveMemo(text, scope);
        },
      });
      return;
    }

    if (act === "pick") {
      const lines = this.data.msgs
        .filter((m) => m.type === "me" && m.text)
        .slice(-3)
        .map((m) => (m.text.length > 18 ? m.text.slice(0, 18) + "…" : m.text));
      if (!lines.length) {
        wx.showToast({ title: "今天还没有对话", icon: "none" });
        return;
      }
      wx.showActionSheet({
        itemList: lines,
        success: (res) => {
          const text = lines[res.tapIndex];
          this.collapseDrawer();
          const scope = this.data.meSeg === "project" ? "project" : "user";
          this._saveMemo(text, scope);
        },
      });
      return;
    }

    if (act === "export") {
      wx.showToast({ title: "暂不支持导出，可截图或长按复制", icon: "none", duration: 2000 });
      return;
    }

    if (act === "off") {
      wx.showModal({
        title: "全部停用",
        content: "停用后 AI 不再参考这些习惯，但已生成的文书不受影响。",
        confirmText: "全部停用",
        confirmColor: "#d92c20",
        success: (res) => {
          if (!res.confirm) return;
          this.setData({ memos: [] }, () => this.refreshViews(this.data.query));
          this.collapseDrawer();
          wx.showToast({ title: "已全部停用", icon: "none" });
        },
      });
      return;
    }
  },

  /* ---------------- 吸顶日期 + 跳转 ---------------- */

  /** 量出每个日期头的位置（相对滚动容器） */
  measureSections() {
    const q = wx.createSelectorQuery();
    q.select(".inboxlist").boundingClientRect();
    q.selectAll(".dayhd").boundingClientRect();
    q.exec((res) => {
      const box = res && res[0];
      const heads = res && res[1];
      if (!box || !heads || !heads.length) return;
      this._secTops = heads.map((h) => Math.round(h.top - box.top));

      const first = this.data.recordsView[0];
      if (first) {
        this.setData({
          stickyDate: first.date,
          stickyWeek: first.week,
          stickyCount: first.count,
          pickDate: (first.date || "").replace("今天 · ", "").replace("昨天 · ", ""),
        });
      }
    });
  },

  /** 滚动时更新吸顶内容 */
  onListScroll(e) {
    const tops = this._secTops;
    const list = this.data.recordsView;
    if (!tops || !tops.length || !list.length) return;

    const y = e.detail.scrollTop + 2;
    let idx = 0;
    for (let i = 0; i < tops.length; i++) {
      if (y >= tops[i]) idx = i;
    }

    const cur = list[idx];
    const next = list[idx + 1];
    if (!cur) return;

    // 下一段快顶上来时，让当前这条"被推上去半个字高"
    const lift = next && tops[idx + 1] - y < 56;

    const patch = {};
    if (this.data.stickyDate !== cur.date) {
      patch.stickyDate = cur.date;
      patch.stickyWeek = cur.week;
    }
    if (this.data.stickyCount !== cur.count) patch.stickyCount = cur.count;
    if (this.data.stickyIdx !== idx) patch.stickyIdx = idx;
    if (this.data.stickyLift !== lift) patch.stickyLift = lift;
    if (this.data.showToday !== idx > 0) patch.showToday = idx > 0;
    if (Object.keys(patch).length) this.setData(patch);
  },

  /** 点吸顶条选日期 → 跳到最近的那一段 */
  onPickDate(e) {
    const v = e.detail.value; // 2026-11-04
    const list = this.data.recordsView;
    if (!list || !list.length) return;

    const mmdd = v.slice(5); // 11-04
    let idx = list.findIndex((g) => (g.date || "").indexOf(mmdd) >= 0);
    if (idx < 0) idx = 0;

    fb.tap();
    this.setData({ jumpAnchor: "" }, () => {
      wx.nextTick(() => this.setData({ jumpAnchor: "sec" + idx }));
    });
  },

  /** 回到今天 */
  onBackToday() {
    fb.tap();
    this.setData({ jumpAnchor: "" }, () => {
      wx.nextTick(() => this.setData({ jumpAnchor: "sec0" }));
    });
  },
  /* ---------------- 记录行右滑签收 ---------------- */

  /** 资料类别 → 封面照片 */
  docCoverOf(kind, name) {
    const t = (kind || "") + (name || "");
    if (t.indexOf("通知单") >= 0) return "doc-review";
    if (t.indexOf("日志") >= 0) return "concrete-pour";
    if (t.indexOf("旁站") >= 0) return "rebar-tie";
    if (t.indexOf("影像") >= 0) return "rebar-tie";
    if (t.indexOf("方案") >= 0 || t.indexOf("图纸") >= 0) return "rebar-struct";
    return "doc-review";
  },

  /** 文书类型 → 现场封面照片 */
  coverOf(kind) {
    if (kind && kind.indexOf("通知单") >= 0) return "doc-review";
    if (kind && kind.indexOf("日志") >= 0) return "concrete-pour";
    if (kind && kind.indexOf("旁站") >= 0) return "rebar-tie";
    if (kind && kind.indexOf("钢筋") >= 0) return "rebar-tie";
    return "rebar-struct";
  },

  onRowStart(e) {
    const t = e.touches[0];

    // 互斥：滑这一行时，别的行全部收起
    const anyOpen = [].concat(...this.data.recordsView.map((g) => g.items)).some((i) => i.sx);
    if (anyOpen) {
      const cv = this.data.recordsView.map((g) =>
        Object.assign({}, g, { items: g.items.map((i) => Object.assign({}, i, { sx: 0 })) })
      );
      this.setData({ recordsView: cv });
    }
    this._rowX0 = t.clientX;
    this._rowY0 = t.clientY;
    this._rowId = e.currentTarget.dataset.id;
    this._rowAxis = "";
  },

  onRowMove(e) {
    if (this._rowId == null) return;
    const t = e.touches[0];
    const dx = t.clientX - this._rowX0;
    const dy = this._rowY0 - t.clientY;

    if (!this._rowAxis) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      this._rowAxis = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
    }
    if (this._rowAxis !== "h") return;

    // 只允许往左滑（露出右侧按钮），最多 200rpx
    const sx = Math.max(-R(160), Math.min(0, dx));

    const recordsView = this.data.recordsView.map((g) => ({
      date: g.date,
      week: g.week,
      count: g.count,
      items: g.items.map((it) =>
        it.id === this._rowId ? Object.assign({}, it, { sx }) : Object.assign({}, it, { sx: it.sx || 0 })
      ),
    }));
    this.setData({ recordsView });
  },

  onRowEnd() {
    if (this._rowId == null) return;
    const id = this._rowId;
    const axis = this._rowAxis;
    this._rowId = null;
    this._rowAxis = "";

    // 滑得够多就停在打开位，否则弹回去
    const recordsView = this.data.recordsView.map((g) => ({
      date: g.date,
      week: g.week,
      count: g.count,
      items: g.items.map((it) => {
        const sx = it.sx || 0;
        if (it.id === id && axis === "h") {
          return Object.assign({}, it, { sx: sx < -R(50) ? -R(160) : 0 });
        }
        return it.id === id ? Object.assign({}, it, { sx: 0 }) : it;
      }),
    }));
    this.setData({ recordsView });
  },

  /** 点签收 */
  onSignRow(e) {
    const id = e.currentTarget.dataset.id;
    fb.success();

    const recordsView = this.data.recordsView.map((g) => ({
      date: g.date,
      week: g.week,
      count: g.count,
      items: g.items.map((it) => {
        if (it.id !== id) return Object.assign({}, it, { sx: 0 });
        return Object.assign({}, it, { sx: 0, state: "已签", st: "ok" });
      }),
    }));
    this.setData({ recordsView });
    wx.showToast({ title: "已签收", icon: "none" });
  },
  /* ---------------- 图片预览 / 资料长按 ---------------- */

  /** 点开大图，可左右翻 */
  onPreviewPhoto(e) {
    const src = e.currentTarget.dataset.src;
    if (!src) return;
    const list = [].concat(
      ...this.data.msgs.filter((m) => m.photos && m.photos.length).map((m) => m.photos)
    );
    fb.tap();
    wx.previewImage({ current: src, urls: list.length ? list : [src] });
  },

  /** 资料行长按：预览 / 删除 */
  onDocLong(e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name || "";
    fb.tap();
    wx.showActionSheet({
      itemList: ["预览", "从资料里移除"],
      success: (res) => {
        if (res.tapIndex === 0) {
          const docId = String(id || "").charAt(0) === "f" ? String(id).slice(1) : "";
          if (/^\d+$/.test(docId)) {
            wx.navigateTo({ url: "/pages/draft/draft?id=" + docId });
          } else {
            wx.showToast({ title: name + "：这份没有关联文书", icon: "none" });
          }
          return;
        }
        wx.showModal({
          title: "移除这份资料",
          content: "只从列表里移走，原文件不受影响。",
          confirmText: "移除",
          confirmColor: "#d92c20",
          success: (r) => {
            if (!r.confirm) return;
            this._baseDocs = this._baseDocs.filter((d) => d.id !== id);
            this.setData({ docs: this._baseDocs.slice() }, () => this.refreshViews(this.data.query));
          },
        });
      },
    });
  },

  /* ---------------- 附件：图片 / 语音，可与文字自由组合 ---------------- */

  /** 只允许相册走系统选择；任何“拍照”都走带水印的现场拍照页 */
  onAddPhoto(source) {
    fb.tap();
    if (source !== "album") {
      this.onWatermarkCamera();
      return;
    }
    const left = 9 - this.data.attach.filter((a) => a.kind === "photo").length;
    if (left <= 0) {
      wx.showToast({ title: "最多 9 张", icon: "none" });
      return;
    }

    wx.chooseMedia({
      count: left,
      mediaType: ["image"],
      sourceType: ["album"],
      sizeType: ["compressed"],
      success: (res) => {
        const add = (res.tempFiles || []).map((f, i) => ({
          id: "a" + Date.now() + i,
          kind: "photo",
          src: f.tempFilePath,
        }));
        this.setData({ attach: this.data.attach.concat(add) });
      },
      fail: () => {},
    });
  },

  onRemoveAttach(e) {
    const id = e.currentTarget.dataset.id;
    fb.tap();
    this.setData({ attach: this.data.attach.filter((a) => a.id !== id) });
  },

  /** ＋ 按钮：一个入口，五种附件 */
  onAddAttach() {
    fb.tap();
    wx.showActionSheet({
      itemList: ["拍照（带水印）", "从相册选", "录一段语音", "从聊天导入", "粘贴文字"],
      success: (res) => {
        if (res.tapIndex === 0) this.onWatermarkCamera();
        else if (res.tapIndex === 1) this.onAddPhoto("album");
        else if (res.tapIndex === 2) this.onAttachMicStart();
        else if (res.tapIndex === 3) this.onImportChatImage();
        else if (res.tapIndex === 4) this.onImportClipboard();
      },
    });
  },

  /** 聊天里拍照：走现场拍照页，水印烧进图后再作为附件 */
  onWatermarkCamera() {
    const left = 9 - this.data.attach.filter((a) => a.kind === "photo").length;
    if (left <= 0) {
      wx.showToast({ title: "最多 9 张", icon: "none" });
      return;
    }
    wx.navigateTo({
      url: "/pages/capture/capture?mode=chat",
      events: {
        captured: (p) => {
          if (!p || !p.src) return;
          this.setData({
            attach: this.data.attach.concat([
              { id: "a" + Date.now(), kind: "photo", src: p.src },
            ]),
          });
          wx.showToast({ title: "已加入聊天附件", icon: "none" });
        },
      },
    });
  },

  /** 开始录一段（点一下开始，再点停止） */
  onAttachMicStart() {
    if (this.data.attachRecording) return;
    fb.bump();
    this._arStart = Date.now();
    this.setData({ attachRecording: true, recDur: "0:00" });

    clearInterval(this._arTimer);
    this._arTimer = setInterval(() => {
      const sec = Math.round((Date.now() - this._arStart) / 1000);
      const m = Math.floor(sec / 60);
      const ss = sec % 60;
      this.setData({ recDur: m + ":" + (ss < 10 ? "0" : "") + ss });
    }, 500);

    try {
      if (!this._rec) {
        this._rec = wx.getRecorderManager();
        this._rec.onStop((res) => this._attachAudioDone(res));
        this._rec.onError(() => {});
      }
      this._recMode = "attach";
      this._rec.start({ duration: 60000, format: "mp3", sampleRate: 16000, numberOfChannels: 1, encodeBitRate: 48000 });
    } catch (e) {
      this.setData({ attachRecording: false });
    }
  },

  onAttachMicEnd() {
    this.onStopAttach();
  },

  /** 停止录音 */
  onStopAttach() {
    if (!this.data.attachRecording) return;
    clearInterval(this._arTimer);
    fb.tap();
    this.setData({ attachRecording: false });
    try {
      if (this._rec) this._rec.stop();
    } catch (e) {}
  },

  /** 录音结束 → 加进附件条 */
  _attachAudioDone(res) {
    if (this._recMode !== "attach") return;
    this._recMode = "";
    // 必须用 onStop 给的 tempFilePath：之前写死空串，语音根本传不上去
    const src = (res && res.tempFilePath) || "";
    const sec = Math.max(1, Math.round((Date.now() - (this._arStart || Date.now())) / 1000));
    const dur = Math.floor(sec / 60) + ":" + (sec % 60 < 10 ? "0" : "") + (sec % 60);
    if (!src) {
      wx.showToast({ title: "录音没保存成功，再试一次", icon: "none" });
      return;
    }
    this.setData({
      attach: this.data.attach.concat([{ id: "v" + Date.now(), kind: "audio", dur, src }]),
    });
  },
  /* ---------------- 气泡长按菜单 ---------------- */

  /** 展开 / 收起某条回复的处理轨迹 */
  onTraceToggle(e) {
    const id = e.currentTarget.dataset.id;
    fb.tap();
    this._traceOpen = this._traceOpen || {};
    this._traceOpen[id] = !this._traceOpen[id];
    this.refreshViews(this.data.query);
  },

  onMsgLong(e) {
    const id = e.currentTarget.dataset.id;
    const msg = this.data.msgs.filter((m) => m.id === id)[0];
    if (!msg) return;

    fb.tap();
    const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]) || {};
    const win_ = win.windowWidth;
    const x = Math.min(Math.max(16, (t.clientX || win_ / 2) - 110), win_ - 236);

    this.setData({
      menuOpen: true,
      menuId: id,
      menuVoice: !!msg.voice,
      menuX: x,
      menuY: Math.max(90, (t.clientY || 300) - 60),
    });
  },

  closeMenu() {
    if (this.data.menuOpen) this.setData({ menuOpen: false });
  },

  /** 长按菜单当前指向的那条 */
  _menuMsg() {
    return this.data.msgs.filter((m) => m.id === this.data.menuId)[0] || null;
  },

  /** 引用某一条：气泡上长按 → 引用 */
  onMenuQuote() {
    const msg = this._menuMsg();
    this.setData({ menuOpen: false, imMode: "text" });
    if (!msg) return;
    const who = msg.type === "agent" ? "助手" : "我";
    const text = (msg.text || (msg.photos ? "[" + msg.photos.length + " 张照片]" : "语音")).slice(0, 40);
    fb.tap();
    this.setData({ quoting: { id: msg.id, who, text } });
    this.setMode("input");
    wx.nextTick(() => this.setData({ imFocus: true }));
  },

  onCancelQuote() {
    fb.tap();
    this.setData({ quoting: null });
  },

  /** 转发：小程序里不能直接把消息转发到群，先复制成一段可粘贴的文字 */
  onMenuForward() {
    const msg = this._menuMsg();
    this.setData({ menuOpen: false });
    if (!msg) return;

    const lines = [];
    if (msg.from || msg.voice) lines.push("【" + (msg.voice ? "语音 " + msg.dur : "图片") + "】");
    if (msg.text) lines.push(msg.text);
    const body = lines.join("\n") || "（无文字内容）";

    wx.setClipboardData({
      data: body,
      success: () => {
        wx.showModal({
          title: "已复制",
          content: "这条内容已复制，可以粘贴到群里。图片需要单独发送。",
          showCancel: false,
          confirmText: "好",
        });
      },
    });
  },
  onMenuCopy() {
    const msg = this._menuMsg();
    this.setData({ menuOpen: false });
    if (!msg) return;
    wx.setClipboardData({
      data: msg.text || "",
      success: () => wx.showToast({ title: "已复制", icon: "none" }),
    });
  },

  onMenuText() {
    const msg = this._menuMsg();
    this.setData({ menuOpen: false });
    if (!msg) return;
    // 真机上这里有后端返回的转写文本，现在用同一条内容去掉语音条
    const msgs = this.data.msgs.map((m) => (m.id === msg.id ? Object.assign({}, m, { voice: false }) : m));
    this.setData({ msgs }, () => this.refreshViews(this.data.query));
    wx.showToast({ title: "已转成文字", icon: "none" });
  },

  onMenuDelete() {
    const msg = this._menuMsg();
    this.setData({ menuOpen: false });
    if (!msg) return;

    wx.showModal({
      title: "删除这条记录",
      content: "删掉后不可恢复。已经生成的文书不受影响。",
      confirmText: "删除",
      confirmColor: "#d92c20",
      success: (res) => {
        if (!res.confirm) return;
        const msgs = this.data.msgs.filter((m) => m.id !== msg.id);
        this.setData({ msgs }, () => this.refreshViews(this.data.query));
      },
    });
  },
  /* ---------------- 从微信导入 ---------------- */

  /** 从聊天会话里挑图片（wx.chooseMessageFile） */
  onImportChatImage() {
    fb.tap();
    this.collapseDrawer();

    wx.chooseMessageFile({
      count: 9,
      type: "image",
      success: (res) => {
        const files = res.tempFiles || [];
        if (!files.length) return;

        const wm = store.watermarkInfo();
        files.forEach((f) => {
          let saved = f.path;
          try {
            saved = wx.getFileSystemManager().saveFileSync(f.path);
          } catch (e) {}
          uploader
            .upload(saved)
            .then((remote) =>
              store.addPhoto({
                id: "p" + Date.now() + Math.random().toString(36).slice(2, 6),
                src: remote || saved,
                local: saved,
                project: wm.project,
                place: wm.place,
                time: wm.time,
                weather: wm.weather,
                from: "chat",
              })
            )
            .then(() => {
              // 本机图片已经能用了，先把资料页刷一遍；后端影像再补一次
              this.setData({ photoCount: store.photos().length });
              this.refreshViews(this.data.query);
              this._loadPhotos();
            });
        });

        try {
          wx.vibrateShort({ type: "medium" });
        } catch (e) {}
        this.setData({ photoCount: store.photos().length });
        wx.showToast({ title: "已导入 " + files.length + " 张", icon: "none" });
      },
      fail: () => {},
    });
  },

  /** 从剪贴板导入文字 */
  onImportClipboard() {
    fb.tap();
    this.collapseDrawer();

    wx.getClipboardData({
      success: (res) => {
        const text = (res.data || "").trim();
        if (!text) {
          wx.showToast({ title: "剪贴板是空的", icon: "none" });
          return;
        }
        this._draft = text;
        this.setData({ draft: text, draftSeed: text, hasDraft: true,
                       imMode: "text", kbHeight: 0 });
        this.setMode("input");
        wx.showToast({ title: "已粘贴到输入框", icon: "none" });
      },
      fail: () => {
        wx.showToast({ title: "读不到剪贴板", icon: "none" });
      },
    });
  },

  /** 打开文字输入时，剪贴板有内容就给个粘贴提示 */
  checkClipboard() {
    wx.getClipboardData({
      success: (res) => {
        const text = (res.data || "").trim();
        if (text && text !== (this._draft || "")) {
          this._clipFull = text;
          this.setData({ clipText: text.length > 12 ? text.slice(0, 12) + "…" : text });
        }
      },
      fail: () => {},
    });
  },

  /** 点粘贴：把剪贴板塞进输入框 */
  onPasteChip() {
    const text = this._clipFull || "";
    if (!text) return;
    fb.tap();
    this._draft = text;
    this.setData({ draft: text, draftSeed: text, hasDraft: true, clipText: "", imFocus: true });
  },
  /** 项目信息编辑 */
  onProjectEdit() {
    fb.tap();
    wx.navigateTo({ url: "/pages/project/project" });
  },

  /** 退出登录 */
  onLogout() {
    wx.showModal({
      title: "退出登录",
      content: "退出后记录不再同步到项目，本地草稿会保留。",
      confirmText: "退出",
      confirmColor: "#d92c20",
      success: (res) => {
        if (!res.confirm) return;
        getApp().clearSession();
        this.setData({ logged: false, userName: "", userRole: "", userInitial: "李" });
        wx.showToast({ title: "已退出", icon: "none" });
      },
    });
  },

  onToggleHaptic() {
    const next = !this.data.hapticOn;
    this.setData({ hapticOn: next });
    fb.save(next, this.data.soundOn);
    if (next) fb.bump();   // 打开时立刻给一下，让人知道生效了
  },

  onToggleSound() {
    const next = !this.data.soundOn;
    this.setData({ soundOn: next });
    fb.save(this.data.hapticOn, next);
    if (next) fb.tick();
  },

  /* ---------------- 其它可点区域 ---------------- */

  /** 顶部项目胶囊：切换项目 */
  /** 切项目：列表来自服务器，切换后重新拉这个项目的数据 */
  onProjectTap() {
    fb.tap();
    api
      .get("/api/v1/projects")
      .then((d) => {
        // 后端两种形状都兼容：数组 或 {list:[...]}
        const list = Array.isArray(d) ? d : (d && d.list) || [];
        if (!list.length) {
          wx.showToast({ title: "还没有项目", icon: "none" });
          return;
        }
        if (list.length === 1) {
          wx.showToast({ title: "只有一个项目", icon: "none" });
          return;
        }
        const names = list.map(function (p) {
          const extra = p.builder || p.addr || "";
          return p.name + (extra ? " · " + extra : "");
        });
        wx.showActionSheet({
          itemList: names,
          success: (res) => {
            const picked = list[res.tapIndex];
            if (!picked || picked.id === this._projectId()) return;
            this.switchProject(picked);
          },
        });
      })
      .catch(() => wx.showToast({ title: "项目列表取不到", icon: "none" }));
  },

  /** 真的切：存起来、清干净、重新拉 */
  switchProject(proj) {
    fb.tap();
    try {
      wx.setStorageSync("jl_project", proj.id);
    } catch (e) {}

    this._traceOpen = {};
    this.setData(
      {
        project: { id: proj.id, name: proj.name, sub: proj.builder || proj.sub || "" },
        msgs: [],
        records: [],
        docs: [],
        memos: [],
        projMemos: [],
        query: "",
        quoting: null,
        busy: null,
      },
      () => {
        this.refreshViews("");
        this.loadAll(proj.id);
        wx.showToast({ title: "已切到 " + proj.name, icon: "none" });
      }
    );
  },

  /** 抽屉里的宫格 / 工作区文件 */
  onDrawerItem(e) {
    fb.tap();
    const label = e.currentTarget.dataset.label || "";
    this.collapseDrawer();
    if (label.indexOf("影像") >= 0) {
      wx.navigateTo({ url: "/pages/capture/capture" });
      return;
    }
    if (label) wx.showToast({ title: label + "：暂未开放", icon: "none" });
  },

  /** 记录卡片：进详情 */
  onRecordTap(e) {
    // 已经滑开的行：第一次点只收起，不跳转
    const id = e.currentTarget.dataset.id;
    const opened = [].concat(...this.data.recordsView.map((g) => g.items)).filter((i) => i.id === id)[0];
    if (opened && opened.sx) {
      fb.tap();
      this.onRowEnd();
      const cv = this.data.recordsView.map((g) => Object.assign({}, g, {
        items: g.items.map((i) => Object.assign({}, i, { sx: 0 })),
      }));
      this.setData({ recordsView: cv });
      return;
    }

    fb.tap();
    const kind = e.currentTarget.dataset.kind || "";
    const obj = e.currentTarget.dataset.obj || "";
    wx.navigateTo({
      url: "/pages/draft/draft?kind=" + encodeURIComponent(kind) + "&obj=" + encodeURIComponent(obj),
    });
  },

  /** 资料行：打开真文书（后端文书 id 前面加了 f） */
  onDocTap(e) {
    fb.tap();
    const id = String(e.currentTarget.dataset.id || "");
    const name = e.currentTarget.dataset.name || "";
    const docId = id.charAt(0) === "f" ? id.slice(1) : "";
    if (!/^\d+$/.test(docId)) {
      wx.showToast({ title: name + "：这份没有关联文书", icon: "none" });
      return;
    }
    wx.navigateTo({ url: "/pages/draft/draft?id=" + docId });
  },

  /** 记忆条目：停用 / 删除 */
  /** 待确认规矩：确认才写进项目规矩，否决就作废 */
  onRuleDecide(e) {
    fb.tap();
    const id = e.currentTarget.dataset.id;
    const act = e.currentTarget.dataset.act;
    api
      .post("/api/v1/rule-proposals/" + id + "/" + act, {})
      .then(() => {
        wx.showToast({
          title: act === "accept" ? "已采纳，写进项目规矩" : "已否决",
          icon: "none",
        });
        this.loadAll();
      })
      .catch((err) =>
        wx.showToast({
          title: "没成：" + ((err && err.message) || "网络问题"),
          icon: "none",
        })
      );
  },

  onMemoTap(e) {
    fb.tap();
    const id = e.currentTarget.dataset.id;
    const all = this.data.memos.concat(this.data.projMemos);
    const item = all.find((m) => m.id === id);
    if (!item) return;
    const mid = String(id).replace(/^[mp]/, "");
    const toggle = item.status ? "停用这条" : "恢复这条";
    wx.showActionSheet({
      itemList: [toggle, "删除这条"],
      itemColor: "#d92c20",
      success: (res) => {
        const done = (title) =>
          wx.showToast({ title, icon: "none" });
        if (res.tapIndex === 0) {
          api
            .patch("/api/v1/memories/" + mid, { status: item.status ? 0 : 1 })
            .then(() => {
              done(item.status ? "已停用" : "已恢复");
              this.loadAll();
            })
            .catch((err) => done("没改成：" + ((err && err.message) || "网络问题")));
          return;
        }
        api
          .del("/api/v1/memories/" + mid)
          .then(() => {
            done("已删除");
            this.loadAll();
          })
          .catch((err) => done("没删掉：" + ((err && err.message) || "网络问题")));
      },
    });
  },
  switchSeg(e) {
    const meSeg = e.currentTarget.dataset.seg;
    if (meSeg === this.data.meSeg) return;
    // 切分段要重算 memosView / projMemosView / listEmpty，
    // 不然空状态和顶部条数还停在上一个分段
    this.setData({ meSeg }, () => this.refreshViews(this.data.query));
  },

  /** 拍照：统一走带水印的现场拍照页 */
  onCamera() {
    const app = getApp();
    if (!app.globalData.token) {
      wx.navigateTo({ url: "/pages/login/login?action=record" });
      return;
    }
    this.onWatermarkCamera();
  },

  /** 占位：用于 catchtouchstart，阻止事件冒泡到"按住说话" */
  noop() {},

  /** 语音 / 键盘 切换（微信的形态） */
  toggleImMode() {
    fb.tap();
    const next = this.data.imMode === "voice" ? "text" : "voice";
    if (next === "text") {
      this.setData({ imMode: "text" }, () => {
        wx.nextTick(() => {
          this.setData({ imFocus: true });
          this.checkClipboard();
        });
      });
    } else {
      wx.hideKeyboard({ fail: () => {} });
      this.setData({ imMode: "voice", imFocus: false, kbHeight: 0 });
    }
  },

  /** 滚到时间线底部（键盘弹出、发完消息时） */
  scrollToBottom() {
    this.setData({ tlAnchor: "" }, () => {
      wx.nextTick(() => this.setData({ tlAnchor: "tl-bottom" }));
    });
  },

  /** 失焦 = 键盘一定收起了，这里强制归零（heightchange 不一定发 0） */
  onInputBlur() {
    if (this.data.kbHeight !== 0) this.setData({ kbHeight: 0 });
  },

  /** 键盘高度变化：只抬底部，不推整页（头部保持不动） */
  onKeyboard(e) {
    const h = (e.detail && e.detail.height) || 0;
    if (h !== this.data.kbHeight) this.setData({ kbHeight: h });
    if (h > 0) this.scrollToBottom();
  },

  /**
   * 打字中。
   *
   * 这里**不能**把内容回写到绑定的 value：电脑端输入法合成、回车、粘贴时，
   * 异步回写会冲掉光标位置，表现就是字符重复/错位，看着像乱码。
   * 正文只放 this._draft，界面只更新"有没有字"。
   */
  onType(e) {
    const v = e.detail.value || "";
    this._draft = v;
    const has = !!(v && v.trim());
    if (has !== this.data.hasDraft) this.setData({ hasDraft: has });

    // 存草稿防抖：每敲一下都写 storage 会卡输入
    clearTimeout(this._draftTimer);
    this._draftTimer = setTimeout(() => {
      try {
        if (v) wx.setStorageSync("jl_draft", v);
        else wx.removeStorageSync("jl_draft");
      } catch (err) {}
    }, 400);
  },

  /** 发送文字：插一条自己的气泡 */
  onSend() {
    const text = (this._draft || this.data.draftSeed || "").trim();
    const attach = this.data.attach || [];
    if (!text && !attach.length) return;

    // 先确认登录，再动草稿：没登录时把用户打的字留着
    const app = getApp();
    if (!app.globalData.token) {
      wx.navigateTo({ url: "/pages/login/login?action=record" });
      return;
    }

    // 附件：图片全带上，语音取第一段（多段也能显示时长）
    const photos = attach.filter((a) => a.kind === "photo").map((a) => a.src);
    const audios = attach.filter((a) => a.kind === "audio");

    this._draft = "";
    this.setData({ draft: "", draftSeed: "", hasDraft: false });
    try {
      wx.removeStorageSync("jl_draft");
    } catch (err) {}

    fb.tick();
    const now = new Date();
    const pad = (n) => (n < 10 ? "0" + n : "" + n);
    const hhmm = pad(now.getHours()) + ":" + pad(now.getMinutes());
    const quoting = this.data.quoting;

    const msgs = this.data.msgs.concat([
      {
        id: "t" + Date.now(),
        type: "me",
        text,
        photos,
        voice: audios.length > 0,
        dur: audios[0] ? audios[0].dur : "",
        audioCount: audios.length,
        time: hhmm,
        sync: false,          // 先乐观显示"待上传"，上传成功再改
        quote: quoting ? { who: quoting.who, text: quoting.text } : null,
      },
    ]);
    this.setData({ quoting: null });
    const myId = msgs[msgs.length - 1].id;
    this.setData({ msgs }, () => {
      this.refreshViews(this.data.query);
      this.scrollToBottom();

      // 上传完成（接后端后换成真实结果回调）
      setTimeout(() => {
        const next = this.data.msgs.map((m) => (m.id === myId ? Object.assign({}, m, { sync: true }) : m));
        this.setData({ msgs: next }, () => this.refreshViews(this.data.query));
      }, 900);
    });

    // 真发到服务器，让它去查资料、写文书
    this._sendToServer({ text, photos, audios, hhmm });
  },

  /** 状态条上的秒数，每秒跳一次 —— 这是"它还活着"的最强信号 */
  _startBusyTicker() {
    clearInterval(this._busyTimer);
    this._busyTimer = setInterval(() => {
      const b = this.data.busy;
      if (!b) {
        clearInterval(this._busyTimer);
        return;
      }
      const sec = Math.floor((Date.now() - b.startedAt) / 1000);
      const patch = { busy: Object.assign({}, b, { elapsed: sec }) };
      // 注意：这里必须先把 id 取出来。写在 function(m) 里的话 this 不是页面对象，
      // 匹配永远失败，秒数就一直是 0。
      const pid = this._pendingId;
      if (pid) {
        patch.msgs = this.data.msgs.map(function (m) {
          return m.id === pid ? Object.assign({}, m, { elapsed: sec }) : m;
        });
      }
      this.setData(patch);
    }, 1000);
  },

  _saveInflight(v) {
    try {
      wx.setStorageSync("jl_inflight", v);
    } catch (e) {}
  },

  _clearInflight() {
    clearInterval(this._busyTimer);
    try {
      wx.removeStorageSync("jl_inflight");
    } catch (e) {}
    this.setData({ busy: null });
  },

  /** 从后台/别的页面回来：把没跑完的任务接上 */
  _resumeInflight() {
    let v = null;
    try {
      v = wx.getStorageSync("jl_inflight");
    } catch (e) {}
    if (!v || !v.taskId) return false;
    if (Date.now() - (v.startedAt || 0) > 10 * 60 * 1000) {
      this._clearInflight();
      return false;
    }
    console.log("[resume] 接上任务", v.taskId);
    const now = new Date();
    const pad = (n) => (n < 10 ? "0" + n : "" + n);
    const hhmm = pad(now.getHours()) + ":" + pad(now.getMinutes());
    const pending = {
      id: v.pendingId || "p" + Date.now(),
      type: "agent",
      time: hhmm,
      pending: true,
      text: "",
      elapsed: 0,
      progress: [],
    };
    this._pendingId = pending.id;
    this.setData({
      msgs: this.data.msgs.concat([pending]),
      busy: { taskId: v.taskId, startedAt: v.startedAt || Date.now(), elapsed: 0, progress: [] },
    });
    this._startBusyTicker();
    this._pollTask(v.taskId, v.pendingId, 0);
    return true;
  },
  /** 项目 id：来自 bootstrap 的 project.id，缺省用默认项目 */
  _projectId() {
    const p = this.data.project || {};
    if (p.id) return p.id;
    try {
      const saved = wx.getStorageSync("jl_project");
      if (saved) return saved;
    } catch (e) {}
    return "yun-gu-3qi";
  },

  _userId() {
    const app = getApp();
    const u = (app && app.globalData && app.globalData.user) || {};
    return u.id || 1;
  },

  /** 发一条 → 挂一个"正在处理"的气泡 → 轮询任务 → 换成真回复 */
  _sendToServer({ text, photos, audios, hhmm }) {
    const clientId = "c" + Date.now() + Math.random().toString(36).slice(2, 8);
    const pendingId = "p" + Date.now();

    const startedAt = Date.now();
    // 状态就长在"答案将要出现"的位置：消息流里、AI 那侧
    const pending = {
      id: pendingId,
      type: "agent",
      time: hhmm,
      pending: true,
      text: "",
      elapsed: 0,
      progress: [],
    };
    this._pendingId = pendingId;
    this.setData(
      {
        msgs: this.data.msgs.concat([pending]),
        busy: { taskId: null, startedAt, elapsed: 0, progress: [] },
      },
      () => {
        this.refreshViews(this.data.query);
        this.scrollToBottom();
        this._startBusyTicker();
      }
    );
    wx.showToast({ title: "已发送，正在处理", icon: "none", duration: 1200 });
    console.log("[send] 发出", clientId);

    // 先把图片和语音传上去换 sha，再发 parts —— 后端认 sha，不认本地路径。
    this._uploadParts(text, photos, audios)
      .then((parts) => {
        if (!parts.length) throw new Error("没有可发送的内容");
        return api.post("/api/v1/chat", {
          projectId: this._projectId(),
          userId: this._userId(),
          clientId,
          text,
          parts,
        });
      })
      .then((d) => {
        const taskId = d && d.taskId;
        if (!taskId) throw new Error("服务器没有返回任务号");
        // 真发出去了才清附件，失败时留着让用户重试
        this.setData({ attach: [] });
        console.log("[send] 任务", taskId, "开始轮询");
        this.setData({ busy: Object.assign({}, this.data.busy, { taskId }) });
        this._saveInflight({ taskId, pendingId, startedAt: Date.now() });
        this._pollTask(taskId, pendingId, 0);
      })
      .catch((err) => {
        this._finishPending(pendingId, {
          text: "没发出去：" + ((err && err.message) || "网络异常"),
        });
      });
  },

  /**
   * 把附件换成 parts。
   *
   * parts 是后端的内容模型：文字 / 图片 / 语音可以任意组合。
   * 图片给 sha 就够了；语音还要顺手转写成文字，
   * 这样模型既能看原文（"用户说了什么"）也能在需要时重新听。
   */
  _uploadParts(text, photos, audios) {
    const imgPaths = photos || [];
    const audList = audios || [];

    const jobs = [
      uploader.uploadAll(imgPaths, "photo"),
      uploader.uploadAll(audList.map((a) => a.src), "audio"),
    ];

    return Promise.all(jobs).then(([imgRes, audRes]) => {
      const parts = [];
      if (text) parts.push({ type: "text", text });

      let failed = 0;
      (imgRes || []).forEach((r) => {
        if (r && r.sha) parts.push({ type: "image", blob: r.sha });
        else failed += 1;
      });

      // 逐段转写；转写失败不影响发送，只是少了文字
      const asrJobs = (audRes || []).map((r) => {
        if (!r || !r.sha) return Promise.resolve(null);
        return api
          .post("/api/v1/asr", { blob: r.sha })
          .then((d) => ({ blob: r.sha, transcript: (d && d.text) || "" }))
          .catch(() => ({ blob: r.sha, transcript: "" }));
      });

      return Promise.all(asrJobs).then((auds) => {
        (auds || []).forEach((a) => {
          if (a) parts.push({ type: "audio", blob: a.blob, transcript: a.transcript });
          else failed += 1;
        });
        // 有附件没传上去时说清楚，别笼统地说"没有可发送的内容"
        if (failed && !parts.some((x) => x.type === "image" || x.type === "audio")) {
          // 打日志方便排查：控制台能看到每个附件是"上传失败"还是"服务端没给 sha"
          console.log("[send] 附件全部上传失败，failed =", failed);
          throw new Error("附件上传没成功，看一下控制台 [upload] 的日志");
        }
        return parts;
      });
    });
  },

  /** 轮询任务：2 秒一次，最多 5 分钟 */
  _pollTask(taskId, pendingId, tries) {
    const MAX = 150;
    if (tries >= MAX) {
      this._finishPending(pendingId, { text: "等太久了，任务还在后台跑，过会儿下拉刷新看看。" });
      return;
    }
    setTimeout(() => {
      api
        .get("/api/v1/tasks/" + taskId)
        .then((d) => {
          const st = (d && d.status) || "";
          const list = (d && d.messages) || [];
          const early = list.filter((m) => m.role === "assistant").pop();
          if (early && early.text) {
            // 文书已经写好了 —— 先给用户看，别等复核
            this._fillPending(pendingId, {
              text: early.text,
              trace: early.trace || null,
              traceSum: early.traceSum,
              review: this._reviewOf(early),
              warning: this._warningOf(early),
              cites: early.cites || [],
            });
          }
          if (st === "done") {
            const asst = list.filter((m) => m.role === "assistant").pop();
            const patch = {
              text: (asst && asst.text) || "这轮没有产出内容。",
              review: this._reviewOf(asst),
              warning: this._warningOf(asst),
              trace: (asst && asst.trace) || null,
              traceSum: asst && asst.traceSum,
              msLabel: asst && asst.msLabel,
              artifact: (d && d.artifact) || null,
              cites: (asst && asst.cites) || [],
              noSource: !!(d && d.noSource),
              taskId: taskId,
              reviewState: (d && d.reviewStatus) || "",
              progress: null,
              pending: false,
            };
            this._fillPending(pendingId, patch);
            this._pendingId = null;
            fb.success();
            wx.showToast({ title: "已完成", icon: "none", duration: 1200 });
            this._clearInflight();
            this._maybeReloadDocs();
            // 出稿已完成，复核还在后台：轻量再轮询几次，把复核意见补上
            if (patch.reviewState === "pending") {
              this._pollReview(taskId, pendingId, 0);
            }
            return;
          }
          if (st === "failed" || st === "cancelled") {
            this._fillPending(pendingId, {
              text: "处理失败：" + ((d && d.error) || st),
              failed: true,
            });
            this._pendingId = null;
            wx.showToast({ title: "处理失败", icon: "none", duration: 2000 });
            this._clearInflight();
            return;
          }
          // 还在跑：进度写到这条消息上（它就在答案将要出现的位置）
          const prog = (d && d.progress) || [];
          const qa = (d && d.queueAhead) || 0;
          console.log("[poll]", taskId, st, prog.length, "步");
          this.setData(
            {
              msgs: this.data.msgs.map(function (m) {
                return m.id === pendingId
                  ? Object.assign({}, m, { progress: prog, queueAhead: qa })
                  : m;
              }),
              busy: Object.assign({}, this.data.busy, { progress: prog }),
            },
            () => this.refreshViews(this.data.query)
          );
          this._pollTask(taskId, pendingId, tries + 1);
        })
        .catch(() => this._pollTask(taskId, pendingId, tries + 1));
    }, 800);
  },

  /**
   * 复核结果补投：出稿已经 done，这里只等"复核中→完成"，不挡用户。
   * 窗口 ≈ 10×3s + 30×6s = 210s：实测复核 97s，30s 窗口会让界面永远停在"复核中"。
   */
  _pollReview(taskId, pendingId, tries) {
    if (tries >= 40) return;
    const wait = tries < 10 ? 3000 : 6000;
    setTimeout(() => {
      api
        .get("/api/v1/tasks/" + taskId)
        .then((d) => {
          const st = (d && d.reviewStatus) || "";
          if (st !== "done" && st !== "failed") {
            return this._pollReview(taskId, pendingId, tries + 1);
          }
          const asst = ((d && d.messages) || []).filter((m) => m.role === "assistant").pop();
          this._fillPending(pendingId, {
            review: this._reviewOf(asst),
            reviewState: st,
          });
        })
        .catch(() => this._pollReview(taskId, pendingId, tries + 1));
    }, wait);
  },

  /** 从消息里取复核意见（answer 可能是对象，也可能是 JSON 字符串） */
  _reviewOf(asst) {
    const ans = this._answerOf(asst);
    return (ans && ans.review) || "";
  },

  /** 从消息里取后端警示（例如「有文书没入库」） */
  _warningOf(asst) {
    const ans = this._answerOf(asst);
    return (ans && ans.warning) || "";
  },

  /** answer 字段统一解析：可能是对象，也可能是 JSON 字符串 */
  _answerOf(asst) {
    let ans = asst && asst.answer;
    if (typeof ans === "string") {
      try {
        ans = JSON.parse(ans);
      } catch (e) {
        ans = null;
      }
    }
    return ans || null;
  },

  /** 就地填充这条气泡（幂等，轮询时每轮都能调） */
  _fillPending(id, patch) {
    if (!id) return;
    const msgs = this.data.msgs.map(function (m) {
      if (m.id !== id) return m;
      return Object.assign({}, m, patch, { pending: false });
    });
    this.setData({ msgs }, () => this.refreshViews(this.data.query));
  },

  /** 把"正在处理"的气泡换成结果 */
  _finishPending(pendingId, patch) {
    if (!patch.failed) {
      fb.success();
      wx.showToast({ title: "已完成", icon: "none", duration: 1200 });
    } else {
      wx.showToast({ title: "处理失败", icon: "none", duration: 2000 });
    }
    this._pendingId = null;
    this._clearInflight();

    const now = new Date();
    const pad = (n) => (n < 10 ? "0" + n : "" + n);
    const hhmm = pad(now.getHours()) + ":" + pad(now.getMinutes());
    const base = { id: "r" + Date.now(), type: "agent", time: hhmm, pending: false };
    const done = Object.assign(base, patch);
    const exists = this.data.msgs.some(function (m) {
      return m.pending;
    });
    const msgs = exists
      ? this.data.msgs.map(function (m) {
          return m.pending ? Object.assign({}, done, { id: m.id, time: m.time }) : m;
        })
      : this.data.msgs.concat([done]);
    this.setData({ msgs }, () => {
      this.refreshViews(this.data.query);
      this.scrollToBottom();
    });
  },

  /** 点底部状态条：展开它到底做了哪几步 */
  onBusyTap() {
    const b = this.data.busy;
    if (!b) return;
    fb.tap();
    this.setData({ busy: Object.assign({}, b, { open: !b.open }) });
  },

  /** 生成文书后，资料页要跟着变 */
  /** 点行内标注：规范号看条文，待补字段进文书 */
  onSegTap(e) {
    const ds = e.currentTarget.dataset;
    const kind = ds.kind;
    if (kind === "r" && ds.code) {
      fb.tap();
      api
        .get("/api/v1/standard?code=" + encodeURIComponent(ds.code) +
             "&clause=" + encodeURIComponent(ds.clause || ""))
        .then((d) => {
          wx.showModal({
            title: ds.code + (ds.clause ? " §" + ds.clause : "") + (d && d.title ? " " + d.title : ""),
            content: (d && d.body) || "没有取到条文",
            showCancel: false,
            confirmText: "知道了",
          });
        })
        .catch(() => wx.showToast({ title: "条文取不到", icon: "none" }));
      return;
    }
    if (kind === "g") {
      fb.tap();
      wx.showToast({ title: "待填：" + (ds.gap || ""), icon: "none" });
    }
  },

  /** 点待补 chip：带着栏位名跳到文书，去把这一栏填了 */
  onGapTap(e) {
    const id = e.currentTarget.dataset.id;
    const gap = e.currentTarget.dataset.gap || "";
    const m = this.data.msgs.filter((x) => x.id === id)[0];
    const a = m && m.artifact;
    fb.tap();
    if (!a) {
      wx.showToast({ title: "这一栏在「" + gap + "」", icon: "none" });
      return;
    }
    wx.navigateTo({
      url:
        "/pages/draft/draft?kind=" + encodeURIComponent(a.kind || "文书") +
        "&obj=" + encodeURIComponent(a.obj || "") +
        "&id=" + (a.id || "") +
        "&field=" + encodeURIComponent(gap),
    });
  },

  /** 完整输出太长时，弹出来看 */
  onTraceFull(e) {
    const id = e.currentTarget.dataset.id;
    const idx = Number(e.currentTarget.dataset.idx);
    const m = this.data.msgs.filter((x) => x.id === id)[0];
    const t = m && m.trace && m.trace[idx];
    if (!t) return;
    fb.tap();
    const body = [t.cmd, t.output].filter(Boolean).join("\n\n");
    wx.showModal({
      title: t.text || "输出",
      content: body.slice(0, 1200) || "（没有内容）",
      showCancel: false,
      confirmText: "知道了",
    });
  },

  /** 点时间线里的某一条：单独展开/收起它的细节 */
  onTraceItem(e) {
    const id = e.currentTarget.dataset.id;
    const idx = Number(e.currentTarget.dataset.idx);
    const key = id + ":" + idx;
    const open = this._traceItemOpen || {};
    open[key] = !open[key];
    this._traceItemOpen = open;
    fb.tap();
    this.refreshViews(this.data.query);
  },

  /** 点引用脚注 → 看条号、标准名和摘录（不拉全文：摘录已在消息里） */
  onOpenCite(e) {
    const id = e.currentTarget.dataset.id;
    const ci = Number(e.currentTarget.dataset.ci);
    const m = this.data.msgs.filter((x) => x.id === id)[0];
    const c = m && m.cites && m.cites[ci];
    if (!c) return;
    fb.tap();
    const title = (c.code || "") + " 第 " + (c.clause || "") + " 条" +
      (c.std ? "\n《" + c.std + "》" : (c.title ? "\n" + c.title : ""));
    const body = (c.quote || "（这条没有摘录）") +
      "\n\n出处：" + (c.source || "标准原文");
    wx.showModal({ title: title, content: body, showCancel: false, confirmText: "知道了" });
  },

  /** 打开巡视记录生成页 */
  onOpenReport() {
    fb.tap();
    wx.navigateTo({ url: "/pages/report/report" });
  },

  /** 点回复里的文书卡片 → 打开详情 */
  onOpenArtifact(e) {
    const id = e.currentTarget.dataset.id;
    const m = this.data.msgs.filter((x) => x.id === id)[0];
    const a = m && m.artifact;
    if (!a) return;
    fb.tap();
    wx.navigateTo({
      url: "/pages/draft/draft?kind=" + encodeURIComponent(a.kind || "文书") +
           "&obj=" + encodeURIComponent(a.obj || "") +
           "&id=" + (a.id || ""),
    });
  },

  _maybeReloadDocs() {
    api
      .get("/api/v1/docs?projectId=" + this._projectId())
      .then((d) => {
        const list = (d && d.list) || [];
        if (!list.length) return;
        // 这个接口只回文书；bootstrap 里的影像卡要留着，否则生成一份文书后
        // 「图纸与影像」整组会凭空消失
        const photos = (this._baseDocs || []).filter(
          (x) => (x.kind || "").indexOf("影像") >= 0
        );
        this._baseDocs = list.map((x) => ({
          id: "f" + x.id,
          kind: (x.kind || "文书").slice(0, 3),
          name: x.kind + (x.obj ? " · " + x.obj : ""),
          meta: (x.createdAt || "").slice(5, 16),
          state: x.state,
          tone: x.state === "已签" ? "ok" : "wait",
          icon: "doc",
          visual: false,
        })).concat(photos);
        this.setData({ docs: this._baseDocs.slice() }, () => this.refreshViews(this.data.query));
      })
      .catch(() => {});
  },

  /**
   * 拉后端影像列表。
   * 资料页影像卡要显示真照片，但本机 store 只存这台设备拍过的；
   * 换设备 / 重装 / 后端已有的照片都拿不到，所以这里补一次。
   * url 是相对路径（/api/v1/blobs/<sha>），拼上 API_BASE 才能给 <image>。
   */
  _loadPhotos() {
    if (!API_BASE) return Promise.resolve(); // 演示模式没有后端
    const pid = String(this._projectId() || "");
    // 同一个项目已经在拉了就不再发；项目变了要重拉
    if (this._photosPromise && this._photosPid === pid) return this._photosPromise;
    this._photosPid = pid;
    this._photosPromise = api
      .get("/api/v1/photos?projectId=" + encodeURIComponent(pid) + "&limit=50")
      .then((rows) => {
        // 拉的过程中项目切了（或者刚补到真 id），这批结果作废
        if (pid !== String(this._projectId() || "")) return;
        const abs = (u) => (!u ? "" : /^https?:\/\//.test(u) ? u : API_BASE + u);
        this._remotePhotos = (rows || [])
          .map((p) => Object.assign({}, p, { src: abs(p.url) }))
          .filter((p) => p.src);
        this.refreshViews(this.data.query);
      })
      .catch(() => {
        // 拉不到就继续用本机照片 / 示意图，不打断页面
      })
      .then(() => {
        if (this._photosPid === pid) this._photosPromise = null;
      });
    return this._photosPromise;
  },

  onMicStart(e) {    const app = getApp();
    if (!app.globalData.token) {
      wx.navigateTo({ url: "/pages/login/login?action=record" });
      return;
    }
    if (this._debug) console.log("[mic] start");
    this._downAt = Date.now();
    this._moved = false;
    this._recY0 = e.touches[0].clientY;
    this._recSec = 0;
    fb.bump();
    this.setData({ recording: true, cancel: false, recMode: "send", recTime: "0:00" });

    // 真录音：拿得到音频就带上，转写由后端做
    try {
      if (!this._rec) {
        this._rec = wx.getRecorderManager();
        this._rec.onStop((r) => this._attachAudio(r));
        this._rec.onError(() => {});
      }
      this._recMode = "voice";
      this._rec.start({
        duration: 60000,
        format: "mp3",
        sampleRate: 16000,
        numberOfChannels: 1,
        encodeBitRate: 48000,
      });
    } catch (e) {}

    // 看门狗：万一 touchend 丢失（切后台、来电），最迟 120 秒自动结束
    clearTimeout(this._recWatch);
    this._recWatch = setTimeout(() => {
      if (this.data.recording) {
        clearInterval(this._recTimer);
        this.setData({ recording: false, cancel: false, recMode: "send" });
      }
    }, 120000);

    clearInterval(this._recTimer);
    this._recTimer = setInterval(() => {
      this._recSec += 1;
      const m = Math.floor(this._recSec / 60);
      const s = this._recSec % 60;
      this.setData({ recTime: m + ":" + (s < 10 ? "0" : "") + s });
    }, 1000);
  },

  /** 录音结束：把音频挂到刚插入的那条消息上 */
  _attachAudio(r) {
    if (this._recMode === "attach") return;   // 那是附件录音，别混进来
    const id = this._audioForId;
    const path = r && r.tempFilePath;
    if (!id || !path) return;

    uploader.upload(path).then((remote) => {
      const msgs = this.data.msgs.map((m) =>
        m.id === id ? Object.assign({}, m, { audio: remote || path, real: true }) : m
      );
      this.setData({ msgs }, () => this.refreshViews(this.data.query));
    });
  },

  onMicMove(e) {
    if (!this.data.recording) return;
    const t = e.touches[0];
    const x = t.clientX;
    const w = win.windowWidth;
    this._moved = true;

    // 和微信一样：滑到左边=取消，滑到右边=转文字，中间=发送
    let mode = "send";
    if (x < w * 0.32) mode = "cancel";
    else if (x > w * 0.68) mode = "convert";

    if (mode !== this.data.recMode) {
      this.setData({ recMode: mode, cancel: mode === "cancel" });
    }
  },

  onMicEnd() {
    if (this._debug) console.log("[mic] end, recording=", this.data.recording, "mode=", this.data.recMode);
    if (!this.data.recording) return;


    clearInterval(this._recTimer);
    clearTimeout(this._recWatch);
    const mode = this.data.recMode;
    const dur = this.data.recTime;
    this.setData({ recording: false, cancel: false, recMode: "send" });

    // 取消：什么都不留
    if (mode === "cancel") {
      wx.showToast({ title: "已取消", icon: "none" });
      return;
    }

    // 转写还没接（ASR 在后端做）。**绝不编内容**：
    // 没转写就明说"转写待接入"，让人知道自己说了什么、系统还没识别。
    const text = "（语音 " + dur + "，转写待接入）";
    const msg = { id: "n" + Date.now(), type: "me", voice: true, dur, text, pendingAsr: true };
    wx.showToast({ title: "语音已保存，转写待接入", icon: "none" });
    fb.tick();
    this._audioForId = msg.id;
    try {
      if (this._rec) this._rec.stop();
    } catch (e) {}
    const msgs = this.data.msgs.concat([msg]);
    const myId = msgs[msgs.length - 1].id;
    this.setData({ msgs }, () => {
      this.refreshViews(this.data.query);
      this.scrollToBottom();

      // 上传完成（接后端后换成真实结果回调）
      setTimeout(() => {
        const next = this.data.msgs.map((m) => (m.id === myId ? Object.assign({}, m, { sync: true }) : m));
        this.setData({ msgs: next }, () => this.refreshViews(this.data.query));
      }, 900);
    });
    wx.showToast({ title: "已记下", icon: "none" });
  },

  onMic() {},

  onLoginTap() {
    wx.navigateTo({ url: "/pages/login/login" });
  },
});

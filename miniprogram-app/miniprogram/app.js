const config = require('./config');
const state = require('./utils/state');
const { BG, front } = require('./utils/theme');

App({
  globalData: {
    cloudReady: false,
    statusBar: 20,
    safeBottom: 0,
    systemDark: false,
  },
  onLaunch() {
    this.readSystem();
    this.hideShare();
    if (wx.cloud && config.ENV_ID) {
      wx.cloud.init({ env: config.ENV_ID, traceUser: false });
      this.globalData.cloudReady = true;
      wx.cloud.callFunction({ name: 'login', data: {} }).catch(() => {});
    }
    state.boot(this.globalData.cloudReady);
    if (wx.onThemeChange) {
      wx.onThemeChange((res) => {
        this.globalData.systemDark = !!(res && res.theme === 'dark');
      });
    }
  },
  onShow() {
    this.hideShare();
  },
  hideShare() {
    if (wx.hideShareMenu) wx.hideShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] });
  },
  readSystem() {
    try {
      const sys = wx.getSystemInfoSync();
      this.globalData.statusBar = sys.statusBarHeight || 20;
      if (sys.safeArea && sys.screenHeight) {
        this.globalData.safeBottom = Math.max(0, sys.screenHeight - sys.safeArea.bottom);
      }
      this.globalData.systemDark = sys.theme === 'dark';
    } catch (e) { /* 用默认安全区 */ }
  },
  resolvedTheme() {
    const s = state.get();
    let t = (s.settings && s.settings.theme) || 'auto';
    if (t === 'auto') t = this.globalData.systemDark ? 'night' : 'ink';
    if (['ink', 'night', 'paper', 'mono'].indexOf(t) < 0) t = 'ink';
    return t;
  },
  paintChrome(theme) {
    const bg = BG[theme] || BG.ink;
    try {
      wx.setBackgroundColor({ backgroundColor: bg, backgroundColorTop: bg, backgroundColorBottom: bg });
      wx.setNavigationBarColor({ frontColor: front(theme), backgroundColor: bg });
    } catch (e) { /* 自定义导航下个别基础库会拒绝，页面底色仍由主题 class 决定 */ }
  },
});

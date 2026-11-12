function legacyInfo() {
  try {
    if (wx.getSystemInfoSync) return wx.getSystemInfoSync() || {};
  } catch (e) { /* 旧接口也拿不到 */ }
  return {};
}

function windowInfo() {
  try {
    if (wx.getWindowInfo) {
      const win = wx.getWindowInfo() || {};
      if (win.statusBarHeight || win.screenHeight || win.pixelRatio) return win;
    }
  } catch (e) { /* 落到旧接口 */ }
  return legacyInfo();
}

function deviceInfo() {
  try {
    if (wx.getDeviceInfo) return wx.getDeviceInfo() || {};
  } catch (e) { /* 落到旧接口 */ }
  return legacyInfo();
}

function appTheme() {
  try {
    if (wx.getAppBaseInfo) {
      const base = wx.getAppBaseInfo() || {};
      if (base.theme) return base.theme;
    }
  } catch (e) { /* 再看设备和旧接口 */ }
  const dev = deviceInfo();
  if (dev.theme) return dev.theme;
  return legacyInfo().theme || 'light';
}

// 自定义导航：状态栏高度用 getWindowInfo（旧基础库才退回 getSystemInfoSync），
// 标题行高度按胶囊 top/height 算出，使标题和返回键与胶囊垂直居中。
function navMetrics(win) {
  const sys = win || windowInfo();
  const statusBarHeight = sys.statusBarHeight || 20;
  let menu = null;
  try {
    if (wx.getMenuButtonBoundingClientRect) menu = wx.getMenuButtonBoundingClientRect();
  } catch (e) { /* 没有胶囊就用默认行高 */ }
  let navHeight = 44;
  if (menu && menu.height > 0 && menu.top > 0) {
    const gap = Math.max(0, menu.top - statusBarHeight);
    navHeight = menu.height + gap * 2;
  }
  const navBar = statusBarHeight + navHeight;
  return { statusBarHeight: statusBarHeight, navHeight: navHeight, navBar: navBar };
}

function measure() {
  let statusBar = 20;
  let safeBottom = 0;
  let contentTop = 20;
  let nav = { statusBarHeight: 20, navHeight: 44, navBar: 64 };
  try {
    const sys = windowInfo();
    statusBar = sys.statusBarHeight || 20;
    contentTop = statusBar;
    nav = navMetrics(sys);
    if (sys.safeArea && sys.screenHeight) safeBottom = Math.max(0, sys.screenHeight - sys.safeArea.bottom);
    if (wx.getMenuButtonBoundingClientRect) {
      const menu = wx.getMenuButtonBoundingClientRect();
      if (menu && menu.bottom > statusBar && menu.height > 0) contentTop = menu.bottom;
    }
  } catch (e) { /* 胶囊尺寸拿不到时，只用状态栏高度 */ }
  // statusBar 仍表示「内容避让胶囊的顶距」（menu.bottom），给今天/信箱/写信用，含义不变。
  return {
    statusBar: contentTop,
    safeBottom: safeBottom,
    statusBarHeight: nav.statusBarHeight,
    navHeight: nav.navHeight,
    navBar: nav.navBar,
  };
}

function initial() {
  const box = measure();
  let theme = 'ink';
  try {
    const c = wx.getStorageSync('hx_mp_v1');
    let t = (c && c.settings && c.settings.theme) || 'auto';
    if (t === 'auto') t = appTheme() === 'dark' ? 'night' : 'ink';
    if (t === 'ink' || t === 'night' || t === 'paper' || t === 'mono') theme = t;
  } catch (e) { /* 模块加载时 wx 还不可用就用回信红 */ }
  return {
    theme: theme,
    statusBar: box.statusBar,
    safeBottom: box.safeBottom,
    statusBarHeight: box.statusBarHeight,
    navHeight: box.navHeight,
    navBar: box.navBar,
    online: true,
  };
}

module.exports = { initial, measure, navMetrics, windowInfo, deviceInfo, appTheme };

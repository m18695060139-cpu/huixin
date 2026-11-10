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

function measure() {
  let statusBar = 20;
  let safeBottom = 0;
  let contentTop = 20;
  try {
    const sys = windowInfo();
    statusBar = sys.statusBarHeight || 20;
    contentTop = statusBar;
    if (sys.safeArea && sys.screenHeight) safeBottom = Math.max(0, sys.screenHeight - sys.safeArea.bottom);
    if (wx.getMenuButtonBoundingClientRect) {
      const menu = wx.getMenuButtonBoundingClientRect();
      if (menu && menu.bottom > statusBar && menu.height > 0) contentTop = menu.bottom;
    }
  } catch (e) { /* 胶囊尺寸拿不到时，只用状态栏高度 */ }
  return { statusBar: contentTop, safeBottom: safeBottom };
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
  return { theme: theme, statusBar: box.statusBar, safeBottom: box.safeBottom, online: true };
}

module.exports = { initial, measure, windowInfo, deviceInfo, appTheme };

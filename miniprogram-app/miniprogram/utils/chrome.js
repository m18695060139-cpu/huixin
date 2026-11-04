function initial() {
  let theme = 'ink';
  let statusBar = 20;
  let safeBottom = 0;
  try {
    const sys = wx.getSystemInfoSync();
    statusBar = sys.statusBarHeight || 20;
    if (sys.safeArea && sys.screenHeight) safeBottom = Math.max(0, sys.screenHeight - sys.safeArea.bottom);
    const c = wx.getStorageSync('hx_mp_v1');
    let t = (c && c.settings && c.settings.theme) || 'auto';
    if (t === 'auto') t = sys.theme === 'dark' ? 'night' : 'ink';
    if (t === 'ink' || t === 'night' || t === 'paper' || t === 'mono') theme = t;
  } catch (e) { /* 模块加载时 wx 还不可用就用回信红 */ }
  return { theme: theme, statusBar: statusBar, safeBottom: safeBottom, online: true };
}

module.exports = { initial };

const behavior = require('../../behaviors/settings');
const state = require('../../utils/state');
const actions = require('../../utils/actions');
const { THEMES } = require('../../utils/theme');

function themeSwatches(themeId) {
  const id = themeId || 'auto';
  return THEMES.map(t => ({
    id: t.id,
    name: t.name,
    sw: t.sw,
    auto: !!t.auto,
    on: id === t.id,
  }));
}

function resolvedOf(themeId) {
  const app = getApp();
  let t = themeId || 'auto';
  if (t === 'auto') t = (app.globalData && app.globalData.systemDark) ? 'night' : 'ink';
  if (['ink', 'night', 'paper', 'mono'].indexOf(t) < 0) t = 'ink';
  return t;
}

Page({
  behaviors: [behavior],
  data: { themes: [] },
  onShow() {
    this.bootSettings();
    this.paint();
  },
  paint() {
    const s = state.get().settings || {};
    const themeId = s.theme || 'auto';
    const resolved = resolvedOf(themeId);
    // 外观勾选和页面配色一次 setData，避免先画勾再换色
    this.setData({ theme: resolved, themes: themeSwatches(themeId) });
    getApp().paintChrome(resolved);
  },
  applyLocal(themeId) {
    const resolved = resolvedOf(themeId);
    this.setData({ theme: resolved, themes: themeSwatches(themeId) });
    getApp().paintChrome(resolved);
    const bar = typeof this.getTabBar === 'function' && this.getTabBar();
    if (bar) bar.setData({ hidden: true, theme: resolved });
  },
  onTheme(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    const cur = (state.get().settings || {}).theme || 'auto';
    if (id === cur) return;
    // 先换色、打钩，再在下一帧把本机缓存和云端写入放后台，避免 setStorageSync 挡住这一帧
    this.applyLocal(id);
    const persist = () => {
      actions.saveSettings({ theme: id }).then(r => {
        if (r && r.code === 'risky') {
          this.applyLocal((state.get().settings || {}).theme || 'auto');
          this.toast(r.message);
        }
      });
    };
    if (wx.nextTick) wx.nextTick(persist);
    else persist();
  },
});

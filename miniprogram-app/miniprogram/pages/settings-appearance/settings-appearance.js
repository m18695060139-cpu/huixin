const behavior = require('../../behaviors/settings');
const state = require('../../utils/state');
const actions = require('../../utils/actions');
const { THEMES } = require('../../utils/theme');

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
    this.setData({
      themes: THEMES.map(t => ({
        id: t.id,
        name: t.name,
        sw: t.sw,
        auto: !!t.auto,
        on: themeId === t.id,
      })),
    });
    this.syncChrome();
  },
  onTheme(e) {
    actions.saveSettings({ theme: e.currentTarget.dataset.id }).then(() => this.paint());
  },
});

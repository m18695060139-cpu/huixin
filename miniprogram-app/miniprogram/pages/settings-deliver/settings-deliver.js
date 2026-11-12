const behavior = require('../../behaviors/settings');
const state = require('../../utils/state');
const actions = require('../../utils/actions');

Page({
  behaviors: [behavior],
  data: { deliver: 'morning' },
  onShow() {
    this.bootSettings();
    const s = state.get().settings || {};
    this.setData({ deliver: s.deliver === 'now' ? 'now' : 'morning' });
  },
  onDeliver(e) {
    const v = e.currentTarget.dataset.v === 'now' ? 'now' : 'morning';
    this.setData({ deliver: v });
    actions.saveSettings({ deliver: v });
  },
});

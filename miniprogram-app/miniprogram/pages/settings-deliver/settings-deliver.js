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
    if (v === this.data.deliver) return;
    this.setData({ deliver: v });
    const persist = () => {
      actions.saveSettings({ deliver: v }).then(r => {
        if (r && r.code === 'risky') {
          const cur = (state.get().settings || {}).deliver === 'now' ? 'now' : 'morning';
          this.setData({ deliver: cur });
          this.toast(r.message);
        }
      });
    };
    if (wx.nextTick) wx.nextTick(persist);
    else persist();
  },
});

const behavior = require('../../behaviors/settings');
const state = require('../../utils/state');
const actions = require('../../utils/actions');

Page({
  behaviors: [behavior],
  data: { name: '' },
  onShow() {
    this.bootSettings();
    const s = state.get().settings || {};
    this._name = s.name || '';
    this.setData({ name: s.name || '' });
  },
  onHide() { this.flush(); },
  onUnload() { this.flush(); },
  onInput(e) { this._name = e.detail.value; },
  onBlur(e) {
    this._name = e.detail.value;
    this.flush();
  },
  flush() {
    if (this._saved) return;
    const name = String(this._name != null ? this._name : this.data.name || '').trim();
    const cur = ((state.get().settings || {}).name || '');
    if (name === cur) return;
    this._saved = true;
    const self = this;
    actions.saveSettings({ name: name }).then(r => {
      self._saved = false;
      if (r && r.code === 'risky') self.toast(r.message);
      else self.toast('已保存');
    }).catch(() => { self._saved = false; });
  },
});

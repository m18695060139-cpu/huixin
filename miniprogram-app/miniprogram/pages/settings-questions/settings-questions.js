const behavior = require('../../behaviors/settings');
const state = require('../../utils/state');
const actions = require('../../utils/actions');

Page({
  behaviors: [behavior],
  data: { qText: '' },
  onShow() {
    this.bootSettings();
    const s = state.get().settings || {};
    const text = (s.questions || []).join('\n');
    this._qText = text;
    this._orig = text;
    this.setData({ qText: text });
  },
  onQ(e) { this._qText = e.detail.value; },
  onHide() { this.flush(false); },
  onUnload() { this.flush(false); },
  onSave() { this.flush(true); },
  flush(toastOnOk) {
    const raw = this._qText != null ? this._qText : this.data.qText;
    if (raw === this._orig && !toastOnOk) return;
    const qs = String(raw || '').split('\n').map(s => s.trim()).filter(Boolean);
    if (!qs.length) {
      if (toastOnOk) this.toast('至少留一个问题');
      return;
    }
    const joined = qs.join('\n');
    if (joined === ((state.get().settings || {}).questions || []).join('\n')) {
      this._orig = joined;
      if (toastOnOk) this.toast('已保存。下一封信的提示会换成这些。');
      return;
    }
    this._orig = joined;
    if (toastOnOk) this.toast('已保存。下一封信的提示会换成这些。');
    const persist = () => {
      actions.saveSettings({ questions: qs }).then(r => {
        if (r && r.code === 'risky') {
          this._orig = ((state.get().settings || {}).questions || []).join('\n');
          this.toast(r.message);
        }
      });
    };
    if (wx.nextTick) wx.nextTick(persist);
    else persist();
  },
});

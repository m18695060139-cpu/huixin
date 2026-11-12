const behavior = require('../../behaviors/settings');
const state = require('../../utils/state');
const actions = require('../../utils/actions');

Page({
  behaviors: [behavior],
  data: { habits: [], habitName: '' },
  onShow() {
    this.bootSettings();
    this.unsub = state.subscribe(() => this.paint());
    this.paint();
  },
  onHide() { if (this.unsub) this.unsub(); },
  onUnload() { if (this.unsub) this.unsub(); },
  paint() {
    this.setData({
      habits: (state.get().habits || []).filter(h => !h.archived),
    });
  },
  onHabitName(e) { this._habitName = e.detail.value; },
  onAdd() {
    const name = (this._habitName != null ? this._habitName : this.data.habitName || '').trim();
    if (!name) return;
    actions.saveHabit({ name: name }).then(r => {
      if (r && r.code === 'risky') { this.toast(r.message); return; }
      this._habitName = '';
      this.setData({ habitName: '' });
      this.toast('已添加');
      this.paint();
    });
  },
  onRename(e) {
    const name = (e.detail.value || '').trim();
    const id = e.currentTarget.dataset.id;
    if (!name || !id) return;
    actions.saveHabit({ id: id, name: name }).then(r => {
      if (r && r.code === 'risky') this.toast(r.message);
    });
  },
  onDel(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除这个习惯？',
      content: '以后的打卡里不再出现。以前的记录还留着。',
      confirmText: '删除',
      confirmColor: '#C0352B',
      success: (res) => { if (res.confirm) actions.archiveHabit(id); },
    });
  },
});

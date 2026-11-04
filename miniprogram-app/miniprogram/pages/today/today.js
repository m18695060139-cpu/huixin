const behavior = require('../../behaviors/page');
const state = require('../../utils/state');
const actions = require('../../utils/actions');
const model = require('../../utils/model');
const { today } = require('../../utils/date');

Page({
  behaviors: [behavior],
  data: { poemOffset: 0, memoryOffset: 0 },
  onShow() {
    this.hideShare();
    this._just = this._just || {};
    this.unsub = state.subscribe(() => this.paint());
    this.paint();
  },
  onHide() { if (this.unsub) this.unsub(); },
  onUnload() { if (this.unsub) this.unsub(); },
  onPullDownRefresh() {
    state.refresh().finally(() => wx.stopPullDownRefresh());
  },
  paint() {
    const view = model.todayModel(state.get(), new Date(), {
      justDone: this._just || {},
      poemOffset: this.data.poemOffset || 0,
      memoryOffset: this.data.memoryOffset || 0,
    });
    this.setData(view);
    this.setTab(0, true);
  },
  tabShouldShow() { return true; },
  nextPoem() {
    this.setData({ poemOffset: (this.data.poemOffset || 0) + 1 });
    this.paint();
  },
  nextMemory() {
    this.setData({ memoryOffset: (this.data.memoryOffset || 0) + 1 });
    this.paint();
  },
  goWrite(e) {
    state.setWriteTarget(e.currentTarget.dataset.date, true);
    wx.switchTab({ url: '/pages/write/write' });
  },
  skipBackfill(e) {
    state.skipBackfill(e.currentTarget.dataset.date);
  },
  async openEnv(e) {
    const d = e.currentTarget.dataset.date;
    await actions.markOpened(d);
    wx.navigateTo({ url: '/pages/letter/letter?date=' + d });
  },
  openRead(e) {
    wx.navigateTo({ url: '/pages/letter/letter?date=' + e.currentTarget.dataset.date });
  },
  goLists(e) {
    wx.navigateTo({ url: '/pages/lists/lists?tab=' + (e.currentTarget.dataset.tab || 'todos') });
  },
  onHabit(e) {
    actions.toggleHabit(e.currentTarget.dataset.id, today());
  },
  async onToggle(e) {
    const id = e.currentTarget.dataset.id;
    const before = (state.get().todos || []).find(t => t.id === id);
    await actions.toggleTodo(id);
    if (before && !before.done) {
      this._just = this._just || {};
      this._just[id] = true;
      const self = this;
      setTimeout(() => {
        if (self._just) delete self._just[id];
        self.paint();
      }, 5100);
      this.toast('已完成', { act: 'todo-note', id: id, label: before.note ? '改备注' : '补一句备注' });
    }
    this.paint();
  },
  onIdeaDrop(e) {
    const id = e.currentTarget.dataset.id;
    actions.setIdeaStatus(id, 'dropped').then(() => {
      this.toast('已放下', { act: 'idea-undrop', id: id, label: '撤回' });
    });
  },
  onIdeaTodo(e) {
    actions.ideaToTodo(e.currentTarget.dataset.id).then(r => {
      if (r && r.code === 'risky') this.toast(r.message);
      else this.toast('已转成待办');
    });
  },
});

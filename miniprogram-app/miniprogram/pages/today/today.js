const behavior = require('../../behaviors/page');
const state = require('../../utils/state');
const actions = require('../../utils/actions');
const model = require('../../utils/model');
const nav = require('../../utils/nav');

Page({
  behaviors: [behavior],
  data: { memoryOffset: 0 },
  onShow() {
    this.hideShare();
    this._active = true;
    this._just = this._just || {};
    if (!this.unsub) this.unsub = state.subscribe(() => this.paint());
    this.paint();
  },
  onHide() { this._active = false; },
  onUnload() { this._active = false; if (this.unsub) { this.unsub(); this.unsub = null; } },
  onPullDownRefresh() {
    state.refresh().finally(() => wx.stopPullDownRefresh());
  },
  paint() {
    const replyingDate = state.getReplying();
    const view = model.todayModel(state.get(), new Date(), {
      justDone: this._just || {},
      memoryOffset: this.data.memoryOffset || 0,
      replying: replyingDate ? { date: replyingDate } : null,
    });
    this.setData(view);
    if (!this._active) return;
    this.setTab(0, true);
  },
  tabShouldShow() { return true; },
  nextMemory() {
    this.setData({ memoryOffset: (this.data.memoryOffset || 0) + 1 });
    this.paint();
  },
  goWrite(e) {
    nav.openWrite(e.currentTarget.dataset.date, { editing: true });
  },
  skipBackfill(e) {
    state.skipBackfill(e.currentTarget.dataset.date);
  },
  openEnv(e) {
    const d = e.currentTarget.dataset.date;
    actions.markOpened(d);   // 本机先标成已拆，云端后台存，不用等
    wx.navigateTo({ url: '/pages/letter/letter?date=' + d });
  },
  openRead(e) {
    wx.navigateTo({ url: '/pages/letter/letter?date=' + e.currentTarget.dataset.date });
  },
  goLists(e) {
    wx.navigateTo({ url: '/pages/lists/lists?tab=' + (e.currentTarget.dataset.tab || 'todos') });
  },
  onToggle(e) {
    const id = e.currentTarget.dataset.id;
    const before = Object.assign({}, (state.get().todos || []).find(t => t.id === id));
    actions.toggleTodo(id);   // 本机马上打勾，云端后台存
    if (before.id && !before.done) {
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
    actions.setIdeaStatus(id, 'dropped');
    this.toast('已放下', { act: 'idea-undrop', id: id, label: '撤回' });
  },
  onIdeaTodo(e) {
    this.toast('已转成待办');
    actions.ideaToTodo(e.currentTarget.dataset.id).then(r => {
      if (r && r.code === 'risky') this.toast(r.message);
    });
  },
});

const behavior = require('../../behaviors/page');
const state = require('../../utils/state');
const model = require('../../utils/model');
const { AI_ENABLED } = require('../../config');

Page({
  behaviors: [behavior],
  data: { date: '', replyLoading: false, replyFail: '', mineOpen: false },
  onLoad(query) {
    this.setData({ date: (query && query.date) || '' });
  },
  onShow() {
    this.hideShare();
    this.syncChrome();
    this.unsub = state.subscribe(() => this.paint());
    this.paint();
  },
  onHide() { if (this.unsub) this.unsub(); },
  onUnload() { if (this.unsub) this.unsub(); },
  tabShouldShow() { return false; },
  paint() {
    const view = model.letterModel(state.get(), this.data.date, new Date());
    view.loading = !!this.data.replyLoading;
    view.fail = this.data.replyFail || '';
    view.mineOpen = !!this.data.mineOpen;
    view.showAi = !!AI_ENABLED;
    this.setData({ letter: view });
    if (AI_ENABLED && view.canAsk && !this.data.replyLoading && !this.data.replyFail && !this._started) {
      this._started = true;
      this.askReply();
    }
  },
  async askReply() {
    if (!AI_ENABLED || !wx.cloud) {
      this.data.replyFail = '回信还没接上。你写的信还在。';
      this.setData({ replyFail: this.data.replyFail });
      this.paint();
      return;
    }
    this.data.replyLoading = true;
    this.data.replyFail = '';
    this.setData({ replyLoading: true, replyFail: '' });
    this.paint();
    try {
      const res = await wx.cloud.callFunction({ name: 'reply', data: { date: this.data.date } });
      const r = (res && res.result) || {};
      if (!r.ok) {
        this.data.replyLoading = false;
        this.data.replyFail = r.message || '回信这次没写成，稍后再试。你写的信还在。';
        this.setData({ replyLoading: false, replyFail: this.data.replyFail });
        this.paint();
        return;
      }
      const cur = (state.get().letters || {})[this.data.date] || {};
      const patch = { reply: r.reply, replied_at: r.replied_at || '' };
      if (!cur.mood && r.reply && r.reply.mood) patch.mood = r.reply.mood;
      if (!cur.energy && r.reply && r.reply.energy) patch.energy = r.reply.energy;
      state.upsertLetter(this.data.date, patch);
      (r.todos || []).forEach(t => state.upsertTodo(Object.assign({ done: false, note: '', dropped_at: '' }, t)));
      (r.ideas || []).forEach(i => state.upsertIdea(Object.assign({ status: 'open', dropped_at: '' }, i)));
      this.data.replyLoading = false;
      this.data.replyFail = '';
      this.setData({ replyLoading: false, replyFail: '' });
      this.paint();
    } catch (e) {
      this.data.replyLoading = false;
      this.data.replyFail = '回信这次没写成，稍后再试。你写的信还在。';
      this.setData({ replyLoading: false, replyFail: this.data.replyFail });
      this.paint();
    }
  },
  retryReply() {
    this.data.replyFail = '';
    this.askReply();
  },
  toggleMine() {
    this.setData({ mineOpen: !this.data.mineOpen });
    this.paint();
  },
  onFb(e) {
    const v = Number(e.currentTarget.dataset.x) || 0;
    const cur = (state.get().letters || {})[this.data.date];
    if (!cur || !cur.reply) return;
    const reply = Object.assign({}, cur.reply, { fb: v });
    state.upsertLetter(this.data.date, { reply: reply });
    if (wx.cloud) {
      wx.cloud.callFunction({
        name: 'reply',
        data: { date: this.data.date, feedback: { block: 'lenses', value: v } },
      }).catch(() => {});
    }
  },
  back() { wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/today/today' }) }); },
  goToday() { wx.switchTab({ url: '/pages/today/today' }); },
  takeBack() {
    state.setWriteTarget(this.data.date, true);
    wx.switchTab({ url: '/pages/write/write' });
  },
});

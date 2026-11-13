const behavior = require('../../behaviors/page');
const state = require('../../utils/state');
const model = require('../../utils/model');
const { AI_ENABLED } = require('../../config');
const { letterDay } = require('../../utils/date');
const nav = require('../../utils/nav');
const actions = require('../../utils/actions');

Page({
  behaviors: [behavior],
  data: { date: '', replyLoading: false, replyFail: '', mineOpen: false, burn: { show: false, items: false, holding: false, busy: false, holdW: 0 } },
  onLoad(query) {
    this.setData({ date: (query && query.date) || '' });
  },
  onShow() {
    this.hideShare();
    this.syncChrome();
    this.unsub = state.subscribe(() => this.paint());
    this.paint();
    const self = this;
    if (this.data.letter && this.data.letter.missing && !this._askedRefresh) {
      this._askedRefresh = true;
      Promise.resolve(state.refresh()).then(function () { self.paint(); }).catch(function () {});
    }
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
    state.setReplying(this.data.date);
    this.paint();
    try {
      const res = await wx.cloud.callFunction({ name: 'reply', data: { date: this.data.date, today: letterDay(new Date()) }, timeout: 60000 });
      const r = (res && res.result) || {};
      if (!r.ok) {
        this.data.replyLoading = false;
        this.data.replyFail = r.message || '回信这次没写成，稍后再试。你写的信还在。';
        this.setData({ replyLoading: false, replyFail: this.data.replyFail });
        this.paint();
        return;
      }
      if (!(state.get().letters || {})[this.data.date]) return;
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
    } finally {
      state.setReplying('');
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
    nav.openWrite(this.data.date, { editing: true });
  },
  noop() {},
  onOverlayBack() {
    if (this.data.burn && this.data.burn.busy) {
      this.setData({ 'burn.show': true });
      return;
    }
    if (this.data.burn && this.data.burn.show) {
      this._stopHold();
      this.setData({ 'burn.show': false, 'burn.holding': false });
      return;
    }
    if (this.data.ed && this.data.ed.show) this.closeEditor();
  },
  onBurnAsk() {
    if (this.data.letter && this.data.letter.missing) return;
    if (this.data.burn && this.data.burn.busy) return;
    this._stopHold();
    this.setData({
      'ed.show': false,
      burn: { show: true, items: false, holding: false, busy: false, holdW: 0 },
    });
    const self = this;
    setTimeout(function () { self.measureHold(); }, 50);
  },
  measureHold() {
    const self = this;
    wx.createSelectorQuery().in(this).select('.burn-hold').boundingClientRect(function (r) {
      if (r && r.width) self.setData({ 'burn.holdW': r.width });
    }).exec();
  },
  onBurnKeep() {
    if (this.data.burn && this.data.burn.busy) return;
    this._stopHold();
    this.setData({ 'burn.show': false, 'burn.holding': false });
  },
  onBurnItems() {
    if (this.data.burn && this.data.burn.busy) return;
    this.setData({ 'burn.items': !(this.data.burn && this.data.burn.items) });
  },
  onHoldStart(e) {
    if (this.data.burn && this.data.burn.busy) return;
    const t = (e.touches && e.touches[0]) || {};
    this._hold = { x0: t.clientX || 0, y0: t.clientY || 0 };
    this.setData({ 'burn.holding': true });
    const self = this;
    if (this._holdTimer) clearTimeout(this._holdTimer);
    this._holdTimer = setTimeout(function () { self._finishHold(); }, 1500);
  },
  onHoldMove(e) {
    if (!this._hold) return;
    const t = (e.touches && e.touches[0]) || {};
    const dx = (t.clientX || 0) - this._hold.x0;
    const dy = (t.clientY || 0) - this._hold.y0;
    if (Math.sqrt(dx * dx + dy * dy) > 10) this._stopHold();
  },
  onHoldEnd() { this._stopHold(); },
  _stopHold() {
    if (this._holdTimer) { clearTimeout(this._holdTimer); this._holdTimer = 0; }
    this._hold = null;
    if (this.data.burn && this.data.burn.holding) this.setData({ 'burn.holding': false });
  },
  _finishHold() {
    this._holdTimer = 0;
    this._hold = null;
    this.doBurn();
  },
  async doBurn() {
    const date = this.data.date;
    const items = !!(this.data.burn && this.data.burn.items);
    if (!date || (this.data.burn && this.data.burn.busy)) return;
    this.setData({ 'burn.busy': true, 'burn.holding': false, 'burn.show': true });
    this._started = true; // 阻止再发起回信
    state.setReplying('');
    try {
      const r = await actions.burnLetter(date, items);
      if (!r || r.ok === false) {
        this.setData({ 'burn.busy': false, 'burn.show': true, 'burn.holding': false });
        this.toast((r && r.message) || '没能焚毁，请再试一次');
        return;
      }
      const self = this;
      // 先让栈里还在的 tab 页（信箱/今天）马上按本机新状态重绘，避免 switchTab 后
      // 因 onShow 没触发而继续显示烧掉的信。网页版没有这层问题：它是同一份 DOM 立刻 render。
      try {
        (getCurrentPages() || []).forEach(function (p) {
          if (p && p !== self && typeof p.paint === 'function') {
            p._active = true;
            p.paint();
          }
        });
      } catch (err) { /* 忽略，switchTab 后还会再画一次 */ }
      this.setData({ 'burn.show': false, 'burn.busy': false, 'burn.holding': false }, function () {
        wx.switchTab({
          url: '/pages/mailbox/mailbox',
          success: function () {
            try {
              const pages = getCurrentPages() || [];
              const top = pages[pages.length - 1];
              if (top && typeof top.paint === 'function') {
                top._active = true;
                top.paint();
              }
            } catch (err) { /* 信箱若已因订阅画过，这里失败也无妨 */ }
          },
        });
      });
    } catch (e) {
      this.setData({ 'burn.busy': false, 'burn.show': true, 'burn.holding': false });
      this.toast('没能焚毁，请再试一次');
    }
  },
});

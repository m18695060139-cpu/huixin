const behavior = require('../../behaviors/page');
const state = require('../../utils/state');
const model = require('../../utils/model');
const { addDays, today } = require('../../utils/date');

Page({
  behaviors: [behavior],
  data: { date: '' },
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
    this.setData({ letter: view });
    this.syncChrome();
  },
  back() { wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/today/today' }) }); },
  takeBack() {
    state.setWriteTarget(this.data.date, true);
    wx.switchTab({ url: '/pages/write/write' });
  },
  pickSentence(e) {
    this.openEditor('todo', {
      text: e.currentTarget.dataset.text,
      due: addDays(today(), 3),
      source_date: this.data.date,
    });
  },
});

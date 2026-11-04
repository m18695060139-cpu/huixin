const behavior = require('../../behaviors/page');

Page({
  behaviors: [behavior],
  onShow() {
    this.hideShare();
    this.syncChrome();
  },
  back() { wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/today/today' }) }); },
});

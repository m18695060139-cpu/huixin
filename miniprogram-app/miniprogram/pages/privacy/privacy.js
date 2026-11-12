const behavior = require('../../behaviors/page');

Page({
  behaviors: [behavior],
  onShow() {
    this.hideShare();
    this.syncChrome();
  },
  back() { wx.navigateBack({ fail: () => wx.navigateTo({ url: '/pages/settings/settings' }) }); },
});

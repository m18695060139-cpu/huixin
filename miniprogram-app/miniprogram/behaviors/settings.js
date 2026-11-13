// 设置及其子页：隐藏底栏，统一返回。
const page = require('./page');

module.exports = Behavior({
  behaviors: [page],
  methods: {
    tabShouldShow() { return false; },
    bootSettings() {
      this.hideShare();
      this.syncChrome();
      const bar = typeof this.getTabBar === 'function' && this.getTabBar();
      if (bar) bar.setData({ hidden: true, theme: this.data.theme });
    },
    back() {
      wx.navigateBack({ fail: () => wx.navigateTo({ url: '/pages/settings/settings' }) });
    },
    closeSettings() {
      wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/mailbox/mailbox' }) });
    },
  },
});

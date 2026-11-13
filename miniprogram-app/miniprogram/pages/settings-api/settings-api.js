const behavior = require('../../behaviors/settings');
const ss = require('../../utils/setting-status');

Page({
  behaviors: [behavior],
  data: {
    key: { loading: true },
    keyRisk: ss.KEY_RISK,
  },
  onLoad() {
    const cached = ss.readKeyCache();
    if (cached) this.setData({ key: ss.keyView(cached, '') });
  },
  onShow() {
    this.bootSettings();
    this.loadKey();
  },
  onHide() {
    // 离开就收起完整密钥，和网页版关掉设置一样；说明改用缓存里不带明文的版本
    const cached = ss.readKeyCache();
    if (cached) this.setData({ key: ss.keyView(cached, '') });
    else if (this.data.key) this.setData({ 'key.fresh': '' });
  },
  loadKey() {
    const cached = ss.readKeyCache();
    if (cached && this.data.key && this.data.key.loading) {
      this.setData({ key: ss.keyView(cached, this.data.key.fresh || '') });
    }
    if (ss.isFresh(cached)) return;
    ss.keyCall('status').then(r => {
      ss.writeKeyCache(r);
      const fresh = this.data.key && this.data.key.fresh;
      this.setData({ key: ss.keyView(r, fresh) });
    }).catch(e => {
      if (cached) return;
      this.setData({ key: { loading: false, error: e.message } });
    });
  },
  makeKey() {
    if (this.data.key.busy) return;
    this.setData({ 'key.busy': true });
    ss.keyCall('create').then(r => {
      ss.writeKeyCache(r);
      this.setData({ key: ss.keyView(r, r.key) });
      this.toast('已生成，只显示这一次');
    }).catch(e => { this.setData({ 'key.busy': false }); this.toast(e.message); });
  },
  onNew() { this.makeKey(); },
  onRegen() {
    wx.showModal({
      title: '重新生成密钥？',
      content: '旧密钥会立刻作废，用它的 agent 或工具要换成新的。',
      confirmText: '重新生成',
      success: (res) => { if (res.confirm) this.makeKey(); },
    });
  },
  onRevoke() {
    wx.showModal({
      title: '作废这个密钥？',
      content: '作废后，用它的 agent 或工具马上就读不到你的数据了。',
      confirmText: '作废',
      confirmColor: '#C0352B',
      success: (res) => {
        if (!res.confirm) return;
        this.setData({ 'key.busy': true });
        ss.keyCall('revoke').then(r => {
          ss.writeKeyCache(r);
          this.setData({ key: ss.keyView(r, '') });
          this.toast('已作废');
        }).catch(e => { this.setData({ 'key.busy': false }); this.toast(e.message); });
      },
    });
  },
  onCopy() {
    const doc = this.data.key && this.data.key.doc;
    if (!doc) return;
    wx.setClipboardData({
      data: doc,
      success: () => { if (wx.hideToast) wx.hideToast(); this.toast('已复制'); },
      fail: () => this.toast('没复制上，可以长按上面那段自己复制'),
    });
  },
});

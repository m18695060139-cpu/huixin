const chrome = require('../../utils/chrome');

const CASES = [
  { id: 'short', name: '短记' },
  { id: 'routine', name: '平常的一天' },
  { id: 'low', name: '提不起劲' },
  { id: 'contradictory', name: '前后矛盾' },
  { id: 'wish', name: '只是想想' },
  { id: 'commit', name: '说了要做' },
  { id: 'week', name: '周信样本' },
  { id: 'quarter', name: '季信样本' },
  { id: 'year', name: '年信样本' },
];

function showOf(side, kind) {
  if (!side) return '';
  if (side.blocked || side.code === 'unchecked' || side.code === 'risky' || side.code === 'review') {
    if (side.code === 'unchecked') {
      const n = typeof side.errCode === 'number' && Number.isFinite(side.errCode) ? side.errCode : null;
      return n === null ? '内容接口没有连上，这次不显示。' : ('内容接口没有连上（' + n + '），这次不显示。');
    }
    return '没通过内容检查，不显示。';
  }
  const body = side.body || {};
  if (kind === 'reply') {
    const tasks = (body.tasks || []).map(t => t.text + (t.dueDays ? '（' + t.dueDays + '天）' : '')).join('、');
    return (body.summary || '') + (tasks ? '\n\n待办：' + tasks : '');
  }
  const next = body.next ? '\n\n下周：' + body.next : '';
  return (body.letter || body.summary || '') + next;
}

function secNoteOf(body) {
  if (!body || body.diagnostic !== 'sec') {
    if (body && body.code === 'forbidden') return '这个对比只给已允许的身份。内容接口没有调用。';
    if (body && body.code === 'unconfigured') return '还没有允许试用的身份。内容接口没有调用。';
    return '这次没查成内容接口。';
  }
  const code = typeof body.errCode === 'number' && Number.isFinite(body.errCode) ? body.errCode : null;
  if (body.status === 'accepted') return '内容接口可用。';
  if (body.status === 'risky') return '内容接口返回了风险，没有通过。没有开始对比。';
  if (body.status === 'review') return '内容接口返回了复核，没有通过。没有开始对比。';
  if (body.status === 'unchecked') {
    if (code === 45009) return '内容接口额度用尽（45009）。这次不比较。';
    if (code === -604101 || code === 604101) return '内容接口没有调用权限（' + code + '）。这次不比较。';
    return code === null ? '内容接口没有连上。这次不比较。' : ('内容接口没有连上（' + code + '）。这次不比较。');
  }
  return '这次没查成内容接口。';
}

Page({
  data: {
    cases: CASES,
    busy: false,
    copying: false,
    current: '',
    oldText: '',
    newText: '',
    error: '',
    copyNote: '',
    secNote: '',
    secBusy: false,
    theme: 'ink',
    navBar: 64,
  },
  onShow() {
    const box = chrome.measure();
    let theme = 'ink';
    try {
      const app = getApp();
      if (app && app.resolvedTheme) theme = app.resolvedTheme();
      if (app && app.paintChrome) app.paintChrome(theme);
    } catch (e) { /* 主题拿不到时仍用默认顶距 */ }
    this.setData({ navBar: box.navBar, theme: theme });
  },
  onHide() { this.dropIdentity(); },
  onUnload() { this.dropIdentity(); },
  dropIdentity() { this._copyId = ''; },
  onBack() {
    this.dropIdentity();
    wx.navigateBack({ fail: function () { wx.switchTab({ url: '/pages/settings/settings' }); } });
  },
  onCopy() {
    if (this.data.copying || this.data.busy || this.data.secBusy) return;
    this.dropIdentity();
    this.setData({ copying: true, copyNote: '' });
    const self = this;
    wx.cloud.callFunction({
      name: 'promptPreview',
      data: { action: 'whoami' },
      timeout: 15000,
    }).then(function (res) {
      const body = (res && res.result) || {};
      const id = body.diagnostic === true && typeof body.openid === 'string' ? body.openid : '';
      if (!body.ok || !id) {
        self.dropIdentity();
        self.setData({ copying: false, copyNote: '这次没取到你的测试身份。' });
        return;
      }
      if (!wx.setClipboardData) {
        self.dropIdentity();
        self.setData({ copying: false, copyNote: '这台设备复制不了，这次没有写入剪贴板。' });
        return;
      }
      self._copyId = id;
      wx.setClipboardData({
        data: id,
        success: function () {
          self.dropIdentity();
          if (wx.hideToast) wx.hideToast();
          self.setData({ copying: false, copyNote: '已复制。请到云函数环境变量里整段粘贴。' });
        },
        fail: function () {
          self.dropIdentity();
          self.setData({ copying: false, copyNote: '没复制成。请再点一次。' });
        },
      });
    }).catch(function () {
      self.dropIdentity();
      self.setData({ copying: false, copyNote: '这次没连上，身份没有复制。' });
    });
  },
  onSec() {
    if (this.data.secBusy || this.data.copying || this.data.busy) return;
    this.setData({ secBusy: true, secNote: '' });
    const self = this;
    wx.cloud.callFunction({
      name: 'promptPreview',
      data: { action: 'seccheck' },
      timeout: 15000,
    }).then(function (res) {
      const body = (res && res.result) || {};
      self.setData({ secBusy: false, secNote: secNoteOf(body) });
    }).catch(function () {
      self.setData({ secBusy: false, secNote: '这次没连上，内容接口没有查成。' });
    });
  },
  onPick(e) {
    const id = e.currentTarget.dataset.id;
    if (!id || this.data.busy || this.data.copying || this.data.secBusy) return;
    this.setData({ busy: true, current: id, oldText: '', newText: '', error: '' });
    const self = this;
    wx.cloud.callFunction({
      name: 'promptPreview',
      data: { fixture: id },
      timeout: 60000,
    }).then(function (res) {
      const body = (res && res.result) || {};
      if (body.diagnostic === 'sec') {
        self.setData({ busy: false, error: '这次只检查了内容接口，没有开始对比。' });
        return;
      }
      if (body.diagnostic) {
        self.setData({ busy: false, error: '这次只取了身份，没有开始对比。' });
        return;
      }
      if (!body.ok) {
        let msg = body.message || '没比成';
        if (body.code === 'unchecked' && typeof body.errCode === 'number' && Number.isFinite(body.errCode)) msg += '（' + body.errCode + '）';
        self.setData({ busy: false, error: msg });
        return;
      }
      if (body.saved !== false) {
        self.setData({ busy: false, error: '结果不该被保存，已停下来。' });
        return;
      }
      self.setData({
        busy: false,
        oldText: showOf(body.old, body.kind),
        newText: showOf(body.new, body.kind),
      });
    }).catch(function () {
      self.setData({ busy: false, error: '云函数 promptPreview 还没建好，或这次没连上。' });
    });
  },
});

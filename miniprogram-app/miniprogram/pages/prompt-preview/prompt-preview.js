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
  if (side.blocked) return '没通过内容检查，不显示。';
  const body = side.body || {};
  if (kind === 'reply') {
    const tasks = (body.tasks || []).map(t => t.text + (t.dueDays ? '（' + t.dueDays + '天）' : '')).join('、');
    return (body.summary || '') + (tasks ? '\n\n待办：' + tasks : '');
  }
  const next = body.next ? '\n\n下周：' + body.next : '';
  return (body.letter || body.summary || '') + next;
}

Page({
  data: { cases: CASES, busy: false, current: '', oldText: '', newText: '', error: '' },
  onLoad() {},
  onBack() {
    wx.navigateBack({ fail: function () { wx.switchTab({ url: '/pages/settings/settings' }); } });
  },
  onPick(e) {
    const id = e.currentTarget.dataset.id;
    if (!id || this.data.busy) return;
    this.setData({ busy: true, current: id, oldText: '', newText: '', error: '' });
    const self = this;
    wx.cloud.callFunction({
      name: 'promptPreview',
      data: { fixture: id },
      timeout: 60000,
    }).then(function (res) {
      const body = (res && res.result) || {};
      if (!body.ok) {
        const who = body.code === 'unconfigured' && body.yourOpenId ? ('\n你的身份：' + body.yourOpenId) : '';
        self.setData({ busy: false, error: (body.message || '没比成') + who });
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

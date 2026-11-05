const behavior = require('../../behaviors/page');
const state = require('../../utils/state');
const date = require('../../utils/date');

const LENS = [
  ['health', '健康', '#FF2D55'],
  ['energy', '精力', '#E07A00'],
  ['career', '事业', '#007AFF'],
  ['relation', '关系', '#248A3D'],
];

function lensRows(obj) {
  const o = obj || {};
  return LENS.map(row => ({
    key: row[0],
    name: row[1],
    mark: row[1].slice(0, 1),
    color: row[2],
    text: o[row[0]] || '',
  })).filter(row => row.text);
}

Page({
  behaviors: [behavior],
  data: { missing: true, busy: false, forgotten: [], lenses: [], plans: [] },
  onLoad(query) {
    this.kind = (query && query.kind) || '';
    this.key = query && query.key ? decodeURIComponent(query.key) : '';
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
    const row = (state.get().digests || []).find(d => d.kind === this.kind && d.key === this.key);
    if (!row) {
      this.setData({ missing: true });
      return;
    }
    const c = row.content || {};
    const kindName = { week: '周信', quarter: '季信', year: '年信' }[row.kind] || '信';
    let range = row.key;
    if (row.kind === 'week') range = date.cn(row.key) + ' – ' + date.cn(date.addDays(row.key, 6));
    else if (row.kind === 'quarter') range = String(row.key).replace('-', ' 年 ');
    else if (row.kind === 'year') range = row.key + ' 年';
    if (c.range && c.range[0] && c.range[1]) range = date.cn(c.range[0]) + ' – ' + date.cn(c.range[1]);
    const st = c.stats || null;
    const paras = String(c.letter || '').split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
    this.setData({
      missing: false,
      kindName: kindName,
      eyebrow: kindName + ' · ' + range,
      title: c.title || kindName,
      stats: st ? {
        letters: st.letters || 0,
        energy: st.energyAvg != null ? st.energyAvg : '—',
        todos: st.todosDone || 0,
      } : null,
      paras: paras.length ? paras : [''],
      energyNote: c.energy_note || '',
      forgotten: c.forgotten || [],
      next: c.next || '',
      nextTitle: row.kind === 'week' ? '下周最值得做的一件事' : '接下来',
      lenses: lensRows(c.lenses),
      plans: lensRows(c.plans),
      themes: (c.themes || []).join(' · '),
      imported: !!c.imported,
    });
  },
  back() { wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/mailbox/mailbox' }) }); },
  async rewrite() {
    if (this.data.busy || !wx.cloud) return;
    this.setData({ busy: true });
    wx.showLoading({ title: '正在重写', mask: true });
    try {
      const res = await wx.cloud.callFunction({ name: 'digest', data: { kind: this.kind, key: this.key } });
      const body = (res && res.result) || {};
      wx.hideLoading();
      if (!body.ok) { this.toast(body.message || '没写成'); this.setData({ busy: false }); return; }
      await state.refresh();
      this.toast('写好了');
    } catch (e) {
      wx.hideLoading();
      this.toast('没写成，稍后再试');
    }
    this.setData({ busy: false });
  },
});

const behavior = require('../../behaviors/page');
const state = require('../../utils/state');
const actions = require('../../utils/actions');
const model = require('../../utils/model');

Page({
  behaviors: [behavior],
  data: { mb: 'all', limit: 140 },
  onShow() {
    this.hideShare();
    this.unsub = state.subscribe(() => this.paint());
    this.paint();
  },
  onHide() { if (this.unsub) this.unsub(); },
  onUnload() { if (this.unsub) this.unsub(); },
  onPullDownRefresh() {
    state.refresh().finally(() => wx.stopPullDownRefresh());
  },
  paint() {
    const view = model.mailboxModel(state.get(), new Date(), {
      tab: this.data.mb,
      limit: this.data.limit,
      theme: getApp().resolvedTheme(),
    });
    this.setData(view);
    this.setTab(2, true);
    if (view.state && view.state.ready && view.tab === 'all') {
      const chart = view.state;
      wx.nextTick(() => this.draw(chart));
    }
  },
  onTab(e) {
    this.setData({ mb: e.currentTarget.dataset.tab });
    this.paint();
  },
  older() {
    this.setData({ limit: (this.data.limit || 140) + 140 });
    this.paint();
  },
  goLists(e) {
    const key = e.currentTarget.dataset.key;
    if (key === 'month') return;
    wx.navigateTo({ url: '/pages/lists/lists?tab=' + key });
  },
  goSettings() {
    wx.navigateTo({ url: '/pages/settings/settings' });
  },
  onRow(e) {
    if (e.currentTarget.dataset.kind === 'gap') this.goWrite(e);
    else this.openDay(e);
  },
  goWrite(e) {
    state.setWriteTarget(e.currentTarget.dataset.date, true);
    wx.switchTab({ url: '/pages/write/write' });
  },
  async openDay(e) {
    const d = e.currentTarget.dataset.date;
    const row = (this.data.groups || []).reduce((found, g) => {
      return found || (g.rows || []).find(r => r.date === d);
    }, null);
    const letter = (state.get().letters || {})[d];
    if (letter && letter.sent_at && !letter.opened && !(row && row.sealed)) await actions.markOpened(d);
    wx.navigateTo({ url: '/pages/letter/letter?date=' + d });
  },
  draw(chart) {
    const query = this.createSelectorQuery();
    query.select('#energy').fields({ node: true, size: true }).exec(res => {
      const info = res && res[0];
      if (!info || !info.node || !chart || !chart.pts) return;
      const canvas = info.node;
      const ctx = canvas.getContext('2d');
      const dpr = (wx.getSystemInfoSync && wx.getSystemInfoSync().pixelRatio) || 2;
      const w = info.width || 300;
      const h = info.height || 88;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);
      const pts = chart.pts;
      const n = pts.length || 1;
      const x = i => (n === 1 ? w / 2 : (i * (w - 4)) / (n - 1) + 2);
      const y = v => (h - 10) - ((v - 1) * ((h - 20) / 4));
      ctx.strokeStyle = chart.sep;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y(1) + 2);
      ctx.lineTo(w, y(1) + 2);
      ctx.stroke();
      ctx.strokeStyle = chart.ink;
      ctx.lineWidth = 2.4;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      let seg = [];
      let last = null;
      const flush = () => {
        if (!seg.length) return;
        if (seg.length === 1) {
          ctx.fillStyle = chart.ink;
          ctx.beginPath();
          ctx.arc(seg[0].x, seg[0].y, 2.5, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          seg.forEach((p, i) => { if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); });
          ctx.stroke();
        }
        seg = [];
      };
      pts.forEach((p, i) => {
        if (!p.ok) { flush(); return; }
        const pt = { x: x(i), y: y(p.v) };
        last = pt;
        seg.push(pt);
      });
      flush();
      if (last) {
        ctx.beginPath();
        ctx.fillStyle = chart.card;
        ctx.strokeStyle = chart.ink;
        ctx.lineWidth = 2.4;
        ctx.arc(last.x, last.y, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    });
  },
});

const behavior = require('../../behaviors/settings');
const state = require('../../utils/state');
const actions = require('../../utils/actions');
const { THEMES } = require('../../utils/theme');
const ss = require('../../utils/setting-status');

function themeName(id) {
  const t = THEMES.filter(x => x.id === id)[0];
  return t ? t.name : '跟随系统';
}

Page({
  behaviors: [behavior],
  data: {
    nameValue: '未设置',
    deliverValue: '明早 6:00',
    themeValue: '跟随系统',
    aiValue: '混元（默认）',
    aiOn: !!ss.AI_ENABLED,
    keyValue: '未生成',
    habitValue: '未添加',
    questionValue: '未设置',
  },
  onShow() {
    this.bootSettings();
    if (this.unsub) this.unsub();
    this.unsub = state.subscribe(() => this.paint());
    this.paint();
    this.refreshStatus();
  },
  onHide() { if (this.unsub) { this.unsub(); this.unsub = null; } },
  onUnload() { if (this.unsub) { this.unsub(); this.unsub = null; } },
  paint() {
    const s = state.get().settings || {};
    const habits = (state.get().habits || []).filter(h => !h.archived);
    const qs = (s.questions || []).filter(x => String(x || '').trim());
    this.setData({
      online: state.get().online,
      nameValue: (s.name && String(s.name).trim()) || '未设置',
      deliverValue: s.deliver === 'now' ? '寄出后马上' : '明早 6:00',
      themeValue: themeName(s.theme || 'auto'),
      aiOn: !!ss.AI_ENABLED,
      aiValue: ss.aiRowValue(),
      keyValue: ss.keyRowValue(),
      habitValue: habits.length ? (habits.length + ' 个') : '未添加',
      questionValue: qs.length ? (qs.length + ' 个') : '未设置',
    });
    this.syncChrome();
  },
  refreshStatus() {
    const self = this;
    const jobs = [];
    if (ss.AI_ENABLED) jobs.push(ss.refreshAIIfStale());
    jobs.push(ss.refreshKeyIfStale());
    Promise.all(jobs).then(() => {
      self.setData({
        aiValue: ss.aiRowValue(),
        keyValue: ss.keyRowValue(),
      });
    }).catch(() => {});
  },
  goName() { wx.navigateTo({ url: '/pages/settings-name/settings-name' }); },
  goDeliver() { wx.navigateTo({ url: '/pages/settings-deliver/settings-deliver' }); },
  goAI() { wx.navigateTo({ url: '/pages/settings-ai/settings-ai' }); },
  goAppearance() { wx.navigateTo({ url: '/pages/settings-appearance/settings-appearance' }); },
  goHabits() { wx.navigateTo({ url: '/pages/settings-habits/settings-habits' }); },
  goQuestions() { wx.navigateTo({ url: '/pages/settings-questions/settings-questions' }); },
  goAPI() { wx.navigateTo({ url: '/pages/settings-api/settings-api' }); },
  goDemo() { wx.navigateTo({ url: '/pages/settings-demo/settings-demo' }); },
  goPrivacy() { wx.navigateTo({ url: '/pages/privacy/privacy' }); },
  onWipe() {
    wx.showModal({
      title: '清空全部数据？',
      content: '信件、待办、点子、习惯会从云端和这台手机删掉。',
      confirmText: '继续',
      confirmColor: '#C0352B',
      success: (res) => {
        if (!res.confirm) return;
        wx.showModal({
          title: '再确认一次',
          content: '删掉之后不能恢复。',
          confirmText: '清空',
          confirmColor: '#C0352B',
          success: async (res2) => {
            if (!res2.confirm) return;
            wx.showLoading({ title: '清空中', mask: true });
            ss.clearStatusCaches();
            const r = await actions.wipe();
            wx.hideLoading();
            if (r && r.ok === false) { this.toast(r.message || '没清空'); return; }
            wx.reLaunch({ url: '/pages/today/today' });
          },
        });
      },
    });
  },
});

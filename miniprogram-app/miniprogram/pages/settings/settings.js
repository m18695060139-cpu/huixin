const behavior = require('../../behaviors/page');
const state = require('../../utils/state');
const actions = require('../../utils/actions');
const { THEMES } = require('../../utils/theme');

Page({
  behaviors: [behavior],
  data: { themes: [], habits: [], name: '', qText: '', habitName: '', themeId: 'auto', deliver: 'morning' },
  onShow() {
    this.hideShare();
    this.syncChrome();
    this.paint(true);
    this.unsub = state.subscribe(() => this.paint(false));
  },
  onHide() { if (this.unsub) this.unsub(); },
  onUnload() { if (this.unsub) this.unsub(); },
  paint(resetText) {
    const s = state.get().settings || {};
    const themeId = s.theme || 'auto';
    const patch = {
      themeId: themeId,
      deliver: s.deliver === 'now' ? 'now' : 'morning',
      themes: THEMES.map(t => ({
        id: t.id,
        name: t.name,
        sw: t.sw,
        auto: !!t.auto,
        on: themeId === t.id,
      })),
      habits: (state.get().habits || []).filter(h => !h.archived),
      online: state.get().online,
    };
    if (resetText) {
      patch.name = s.name || '';
      patch.qText = (s.questions || []).join('\n');
    }
    this.setData(patch);
    this.syncChrome();
  },
  back() { wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/mailbox/mailbox' }) }); },
  onName(e) {
    const name = (e.detail.value || '').trim();
    actions.saveSettings({ name: name }).then(r => {
      if (r && r.code === 'risky') this.toast(r.message);
      else this.toast('已保存');
    });
  },
  onTheme(e) {
    actions.saveSettings({ theme: e.currentTarget.dataset.id });
  },
  onDeliver(e) {
    const v = e.currentTarget.dataset.v === 'now' ? 'now' : 'morning';
    actions.saveSettings({ deliver: v });
  },
  onQ(e) { this.setData({ qText: e.detail.value }); },
  onSaveQ() {
    const qs = String(this.data.qText || '').split('\n').map(s => s.trim()).filter(Boolean);
    if (!qs.length) { this.toast('至少留一个问题'); return; }
    actions.saveSettings({ questions: qs }).then(r => {
      if (r && r.code === 'risky') this.toast(r.message);
      else this.toast('已保存。下一封信的提示会换成这些。');
    });
  },
  onHabitName(e) { this.setData({ habitName: e.detail.value }); },
  onAddHabit() {
    const name = (this.data.habitName || '').trim();
    if (!name) return;
    actions.saveHabit({ name: name }).then(r => {
      if (r && r.code === 'risky') { this.toast(r.message); return; }
      this.setData({ habitName: '' });
      this.toast('已添加');
      this.paint(false);
    });
  },
  onRename(e) {
    const name = (e.detail.value || '').trim();
    const id = e.currentTarget.dataset.id;
    if (!name || !id) return;
    actions.saveHabit({ id: id, name: name }).then(r => {
      if (r && r.code === 'risky') this.toast(r.message);
    });
  },
  onDelHabit(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除这个习惯？',
      content: '以后的打卡里不再出现。以前的记录还留着。',
      confirmText: '删除',
      confirmColor: '#C0352B',
      success: (res) => { if (res.confirm) actions.archiveHabit(id); },
    });
  },
  goPrivacy() { wx.navigateTo({ url: '/pages/privacy/privacy' }); },
  onImport() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['json'],
      success: (res) => {
        const file = res.tempFiles && res.tempFiles[0];
        if (!file) return;
        wx.getFileSystemManager().readFile({
          filePath: file.path,
          encoding: 'utf8',
          success: async (r) => {
            let obj;
            try { obj = JSON.parse(r.data); }
            catch (e) { this.toast('这个文件不是 JSON'); return; }
            wx.showLoading({ title: '导入中', mask: true });
            const result = await actions.importJson(obj);
            wx.hideLoading();
            if (!result || result.ok === false) {
              this.toast((result && result.message) || '没有导入');
              return;
            }
            const n = result.imported || {};
            const skip = (result.skipped || []).length;
            this.toast('信 ' + (n.letters || 0) + ' 封' + (skip ? '，跳过 ' + skip + ' 条' : '已导入'));
            this.paint(true);
          },
          fail: () => this.toast('没有读到文件'),
        });
      },
    });
  },
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

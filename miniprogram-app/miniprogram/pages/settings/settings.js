const behavior = require('../../behaviors/page');
const state = require('../../utils/state');
const actions = require('../../utils/actions');
const { THEMES } = require('../../utils/theme');
const { AI_ENABLED } = require('../../config');

// 只读 API 密钥：网页版设置里同一段话
const KEY_RISK = '有了这串密钥，就能读到你全部的信、待办、点子和习惯。只交给你信任的 agent，别发给别人；担心泄露就点作废。接口只能读，不能改。';
// 给 agent 的一整段说明：地址、请求头（带上密钥）、参数、示例、返回什么。一个按钮整段复制（和网页版同一段）
const KEY_HIDDEN = '你的密钥（只在生成时显示过，忘了就重新生成）';
function keyDoc(url, key) {
  const now = new Date(Date.now() + 8 * 3600e3).toISOString();
  const since = now.slice(0, 8) + '01';
  return ['回信只读 API',
    '地址：GET ' + (url || '（接口地址开通后显示在这里）'),
    '请求头：Authorization: Bearer ' + (key || KEY_HIDDEN),
    '可选参数：since=YYYY-MM-DD（只要这天以后的）；type=letters,todos,ideas,habits,digests（只要某几类，逗号分隔）',
    '示例：curl -H "Authorization: Bearer ' + (key || '<你的密钥>') + '" "' + (url || '<接口地址>') + '?since=' + since + '"',
    '返回 JSON：letters（信和回信）、todos、ideas、habits、habit_logs、digests（周信季信年信）。只能读，不能改。每分钟最多 30 次。',
  ].join('\n');
}
// ISO 时间 → 北京时间「11月11日 12:30」
function bjTime(iso) {
  const t = new Date(iso).getTime();
  if (!iso || isNaN(t)) return '';
  const d = new Date(t + 8 * 3600e3).toISOString();
  return Number(d.slice(5, 7)) + '月' + Number(d.slice(8, 10)) + '日 ' + d.slice(11, 16);
}
function keyView(r, fresh) {
  return {
    doc: r.exists ? keyDoc(r.url || '', fresh) : '',
    exists: !!r.exists,
    hint: r.hint || '',
    createdText: bjTime(r.created_at),
    usedText: r.last_used_at ? '最近使用 ' + bjTime(r.last_used_at) : '还没用过',
    fresh: fresh || '',
  };
}

Page({
  behaviors: [behavior],
  data: { themes: [], habits: [], name: '', qText: '', habitName: '', themeId: 'auto', deliver: 'morning',
    key: { loading: true }, keyRisk: KEY_RISK },
  onShow() {
    this.hideShare();
    this.syncChrome();
    this.paint(true);
    this.unsub = state.subscribe(() => this.paint(false));
    this.loadKey();
  },
  // 离开设置页就收起刚生成的完整密钥，和网页版关掉设置一样
  onHide() { if (this.unsub) this.unsub(); this.setData({ 'key.fresh': '', 'key.doc': '' }); },
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
      aiOn: !!AI_ENABLED,
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
  onQ(e) { this.data.qText = e.detail.value; },
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
  keyCall(action) {
    return new Promise((resolve, reject) => {
      if (!wx.cloud) { reject(new Error('云端还没连上')); return; }
      wx.cloud.callFunction({
        name: 'api',
        data: { action: action },
        success: (res) => {
          const r = (res && res.result) || {};
          if (r.ok) resolve(r); else reject(new Error(r.message || '没办成，请稍后再试'));
        },
        fail: () => reject(new Error('云端还没连上，请稍后再试')),
      });
    });
  },
  loadKey() {
    if (!(this.data.key && this.data.key.fresh)) this.setData({ key: { loading: true } });
    this.keyCall('status').then(r => {
      const fresh = this.data.key && this.data.key.fresh;
      this.setData({ key: keyView(r, fresh) });
    }).catch(e => this.setData({ key: { error: e.message } }));
  },
  makeKey() {
    if (this.data.key.busy) return;
    this.setData({ 'key.busy': true });
    this.keyCall('create').then(r => {
      this.setData({ key: keyView(r, r.key) });
      this.toast('已生成，只显示这一次');
    }).catch(e => { this.setData({ 'key.busy': false }); this.toast(e.message); });
  },
  onKeyNew() { this.makeKey(); },
  onKeyRegen() {
    wx.showModal({
      title: '重新生成密钥？',
      content: '旧密钥会立刻作废，用它的 agent 或工具要换成新的。',
      confirmText: '重新生成',
      success: (res) => { if (res.confirm) this.makeKey(); },
    });
  },
  onKeyRevoke() {
    wx.showModal({
      title: '作废这个密钥？',
      content: '作废后，用它的 agent 或工具马上就读不到你的数据了。',
      confirmText: '作废',
      confirmColor: '#C0352B',
      success: (res) => {
        if (!res.confirm) return;
        this.setData({ 'key.busy': true });
        this.keyCall('revoke').then(r => {
          this.setData({ key: keyView(r, '') });
          this.toast('已作废');
        }).catch(e => { this.setData({ 'key.busy': false }); this.toast(e.message); });
      },
    });
  },
  onKeyCopy() {
    const doc = this.data.key && this.data.key.doc;
    if (!doc) return;
    wx.setClipboardData({
      data: doc,
      success: () => { if (wx.hideToast) wx.hideToast(); this.toast('已复制'); },
      fail: () => this.toast('没复制上，可以长按上面那段自己复制'),
    });
  },
  goPrivacy() { wx.navigateTo({ url: '/pages/privacy/privacy' }); },
  onSeed() {
    if (!wx.cloud) { this.toast('云端还没连上'); return; }
    wx.showModal({
      title: '载入示例数据？',
      content: '写入和网页版演示账号同一套信、回信、待办、点子、习惯、周信和季信。已有的内容会留下；同一天已有你自己的信则跳过。',
      confirmText: '载入',
      success: async (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '写入中', mask: true });
        try {
          const r = await wx.cloud.callFunction({ name: 'demoSeed', data: { action: 'seed' } });
          const body = (r && r.result) || {};
          wx.hideLoading();
          if (!body.ok) { this.toast(body.message || '没写进去'); return; }
          await state.refresh();
          this.toast('已载入 ' + (body.letters || 0) + ' 封信');
          this.paint(true);
        } catch (e) {
          wx.hideLoading();
          this.toast('没写进去。请先在开发者工具里上传并部署 demoSeed');
        }
      },
    });
  },
  onClearDemo() {
    if (!wx.cloud) { this.toast('云端还没连上'); return; }
    wx.showModal({
      title: '清除示例数据？',
      content: '只删除标了 demo 的信、待办、点子、习惯、打卡和总结信。你自己写的会留下。',
      confirmText: '清除',
      confirmColor: '#C0352B',
      success: async (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '清除中', mask: true });
        try {
          const r = await wx.cloud.callFunction({ name: 'demoSeed', data: { action: 'clear' } });
          const body = (r && r.result) || {};
          wx.hideLoading();
          if (!body.ok) { this.toast(body.message || '没清除'); return; }
          await state.refresh();
          this.toast('示例数据已清除');
          this.paint(true);
        } catch (e) {
          wx.hideLoading();
          this.toast('没清除。请先上传并部署 demoSeed');
        }
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

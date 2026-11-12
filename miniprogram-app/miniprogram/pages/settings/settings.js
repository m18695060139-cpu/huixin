const behavior = require('../../behaviors/page');
const state = require('../../utils/state');
const actions = require('../../utils/actions');
const { THEMES } = require('../../utils/theme');
const { AI_ENABLED } = require('../../config');

// 只读 API 密钥：网页版设置里同一段话
const KEY_RISK = '有了这串密钥，就能读到你全部的信、待办、点子和习惯。只交给你信任的 agent，别发给别人；担心泄露就点作废。接口只能读，不能改。';

// 自己的 AI：服务商列表、说明和网页版 src/ai.js 同一套。默认未接入时用云开发免费的混元。
const AI_PROVIDERS = {
  deepseek: { name: 'DeepSeek', base: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  zhipu: { name: '智谱 GLM', base: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' },
  qwen: { name: '通义千问', base: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  kimi: { name: 'Kimi', base: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
  siliconflow: { name: '硅基流动', base: 'https://api.siliconflow.cn/v1', model: 'deepseek-ai/DeepSeek-V3' },
  tokenhub: { name: 'TokenHub', base: 'https://tokenhub.tencentmaas.com/v1', model: 'deepseek/deepseek-flash' },
  openrouter: { name: 'OpenRouter', base: 'https://openrouter.ai/api/v1', model: 'deepseek/deepseek-chat' },
  custom: { name: '自定义', base: '', model: '' },
};
const AI_HELP = '接上之后，你的回信和周信都用你自己的 AI 写，花的是你自己的额度。Key 加密保存在服务器上，小程序里只显示后 4 位。DeepSeek、智谱、通义千问、Kimi、硅基流动等大多数服务商都能这样接入；模型名以服务商控制台为准。自己的 AI 出错时，会自动改用混元，不会漏掉回信。';
const AI_IDS = Object.keys(AI_PROVIDERS);

function providerList(P) {
  const src = P || AI_PROVIDERS;
  return AI_IDS.map(id => {
    const p = src[id] || AI_PROVIDERS[id];
    return { id: id, name: p.name, base: p.base || '', model: p.model || '' };
  });
}

function aiView(d, form, extra) {
  const P = (d && d.providers) || AI_PROVIDERS;
  const list = providerList(P);
  const configured = !!(d && d.configured);
  const f = form || {};
  const pid = f.provider || (configured ? d.provider : 'deepseek');
  const pre = P[pid] || AI_PROVIDERS[pid] || AI_PROVIDERS.deepseek;
  const idx = Math.max(0, AI_IDS.indexOf(pid));
  const last4 = (d && d.last4) || '';
  return Object.assign({
    loading: false,
    error: '',
    configured: configured,
    provider: configured ? d.provider : '',
    providerName: configured ? ((P[d.provider] || P.custom || AI_PROVIDERS.custom).name) : '',
    model: configured ? (d.model || '') : '',
    last4: last4,
    providers: list,
    providerNames: list.map(x => x.name),
    providerIndex: idx,
    formProviderName: (P[pid] || pre).name,
    form: {
      provider: pid,
      base_url: f.base_url != null ? f.base_url : (d && d.base_url) || pre.base || '',
      model: f.model != null ? f.model : (d && d.model) || pre.model || '',
      key: f.key || '',
    },
    keyPlaceholder: configured ? ('已保存（尾号 ' + last4 + '），不改就留空') : '粘贴服务商给你的 Key',
    open: !!(extra && extra.open),
    busy: (extra && extra.busy) || '',
    msg: (extra && extra.msg) || '',
    ok: !!(extra && extra.ok),
    data: d || { configured: false, providers: P },
  }, extra && extra.patch || {});
}
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

// 设置页打开时先用上次的状态立刻画出来，再在后台刷新。
// 只缓存服务商、模型、是否已接入、Key 尾号；永远不存 Key 本身。
const AI_CACHE = 'hx_mp_ai_status';
const KEY_CACHE = 'hx_mp_api_status';
const STATUS_FRESH_MS = 60000;

function readStore(name) {
  try {
    const v = wx.getStorageSync(name);
    if (v && typeof v === 'object') return v;
  } catch (e) { /* 忽略 */ }
  return null;
}
function writeStore(name, v) {
  try { wx.setStorageSync(name, v); } catch (e) { /* 空间不够就下次再读云端 */ }
}
function clearStore(name) {
  try { wx.removeStorageSync(name); } catch (e) { /* 忽略 */ }
}
function clearStatusCaches() {
  clearStore(AI_CACHE);
  clearStore(KEY_CACHE);
  if (typeof pageDefaults !== 'undefined' && pageDefaults) {
    pageDefaults.ai = { loading: true };
    pageDefaults.key = { loading: true };
  }
}

function aiStatusSafe(r, fetchedAt) {
  if (!r || typeof r !== 'object') return null;
  return {
    configured: !!r.configured,
    provider: r.provider || '',
    model: r.model || '',
    last4: r.last4 || '',
    base_url: r.base_url || '',
    updated_at: r.updated_at || '',
    fetchedAt: fetchedAt != null ? fetchedAt : (Number(r.fetchedAt) || 0),
  };
}
function writeAICache(r) {
  const s = aiStatusSafe(r, Date.now());
  if (s) {
    writeStore(AI_CACHE, s);
    // 同步默认 data，下次打开设置页第一帧就不是「读取中…」
    if (pageDefaults) pageDefaults.ai = aiView(s, null, { open: !s.configured });
  }
  return s;
}
function readAICache() { return aiStatusSafe(readStore(AI_CACHE)); }
function isFresh(c) {
  return !!(c && c.fetchedAt && (Date.now() - c.fetchedAt) < STATUS_FRESH_MS);
}

function keyStatusSafe(r, fetchedAt) {
  if (!r || typeof r !== 'object') return null;
  return {
    exists: !!r.exists,
    hint: r.hint || '',
    created_at: r.created_at || '',
    last_used_at: r.last_used_at || '',
    url: r.url || '',
    fetchedAt: fetchedAt != null ? fetchedAt : (Number(r.fetchedAt) || 0),
  };
}
function writeKeyCache(r) {
  const s = keyStatusSafe(r, Date.now());
  if (s) {
    writeStore(KEY_CACHE, s);
    if (pageDefaults) pageDefaults.key = keyView(s, '');
  }
  return s;
}
function readKeyCache() { return keyStatusSafe(readStore(KEY_CACHE)); }

const pageDefaults = {
  themes: [], habits: [], name: '', qText: '', habitName: '', themeId: 'auto', deliver: 'morning',
  key: { loading: true }, keyRisk: KEY_RISK,
  ai: { loading: true }, aiHelp: AI_HELP,
};
(function hydrateDefaults() {
  const ai = readAICache();
  const key = readKeyCache();
  if (ai) pageDefaults.ai = aiView(ai, null, { open: !ai.configured });
  if (key) pageDefaults.key = keyView(key, '');
})();

Page({
  behaviors: [behavior],
  data: pageDefaults,
  onLoad() {
    // 同步画缓存，赶在第一帧之前；避免脚本只初始化一次 data 时仍闪「读取中…」
    const patch = {};
    const ai = readAICache();
    const key = readKeyCache();
    if (ai) patch.ai = aiView(ai, null, { open: !ai.configured });
    if (key) patch.key = keyView(key, '');
    if (Object.keys(patch).length) this.setData(patch);
  },
  onShow() {
    this.hideShare();
    this.syncChrome();
    this.paint(true);
    this.unsub = state.subscribe(() => this.paint(false));
    this.loadKey();
    this.loadAI();
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
  onHabitName(e) { this._habitName = e.detail.value; },
  onAddHabit() {
    const name = (this._habitName != null ? this._habitName : this.data.habitName || '').trim();
    if (!name) return;
    actions.saveHabit({ name: name }).then(r => {
      if (r && r.code === 'risky') { this.toast(r.message); return; }
      this._habitName = '';
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
    const cached = readKeyCache();
    // 有缓存就先画出来，不再露出「读取中…」
    if (cached && this.data.key && (this.data.key.loading || this.data.key.error)) {
      this.setData({ key: keyView(cached, this.data.key.fresh || '') });
    }
    if (isFresh(cached)) return;
    this.keyCall('status').then(r => {
      writeKeyCache(r);
      const fresh = this.data.key && this.data.key.fresh;
      this.setData({ key: keyView(r, fresh) });
    }).catch(e => {
      if (cached) return;
      this.setData({ key: { error: e.message } });
    });
  },
  makeKey() {
    if (this.data.key.busy) return;
    this.setData({ 'key.busy': true });
    this.keyCall('create').then(r => {
      writeKeyCache(r);
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
          writeKeyCache(r);
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
  aiCall(action, body) {
    return new Promise((resolve, reject) => {
      if (!wx.cloud) { reject(new Error('云端还没连上')); return; }
      wx.cloud.callFunction({
        name: 'aiConfig',
        data: Object.assign({ action: action }, body || {}),
        success: (res) => {
          const r = (res && res.result) || {};
          if (action === 'test') { resolve(r); return; }
          if (r.ok) resolve(r); else reject(new Error(r.message || '没办成，请稍后再试'));
        },
        fail: () => reject(new Error('云端还没连上。请先在开发者工具里上传并部署 aiConfig')),
      });
    });
  },
  loadAI() {
    if (!AI_ENABLED) return;
    // 正在填表就不要打断
    if (this._aiEditing) return;
    const cached = readAICache();
    if (cached && this.data.ai && this.data.ai.loading) {
      this.setData({ ai: aiView(cached, null, { open: !cached.configured }) });
    }
    if (isFresh(cached)) return;
    this.aiCall('status').then(r => {
      writeAICache(r);
      if (this._aiEditing) return;
      this._aiForm = null;
      this._aiKey = '';
      // 后台刷新时保持用户已经展开或收起的状态；第一次才按「未接入则展开」
      const had = this.data.ai && this.data.ai.data && !this.data.ai.loading;
      const open = had ? !!this.data.ai.open : !r.configured;
      this.setData({ ai: aiView(r, null, { open: open }) });
    }).catch(e => {
      if (this._aiEditing) return;
      if (cached) return;
      // 云函数还没部署时，仍展示默认混元和表单，把原因写在表单里
      this.setData({ ai: aiView({ configured: false, providers: AI_PROVIDERS }, null, { open: true, msg: e.message, ok: false }) });
    });
  },
  onAiToggle() {
    const a = this.data.ai || {};
    if (a.loading || a.error) return;
    const open = !a.open;
    if (open) {
      this._aiKey = '';
      this._aiForm = Object.assign({}, a.form, { key: '' });
      this._aiEditing = true;
    } else {
      this._aiEditing = false;
    }
    this.setData({ ai: aiView(a.data, this._aiForm || a.form, { open: open, msg: '' }) });
  },
  onAiProvider(e) {
    const i = Number(e.detail.value);
    const a = this.data.ai || {};
    const p = (a.providers || [])[i];
    if (!p) return;
    const form = Object.assign({}, this._aiForm || a.form, { provider: p.id, key: (this._aiKey != null ? this._aiKey : (a.form && a.form.key) || '') });
    if (p.id !== 'custom') {
      form.base_url = p.base;
      form.model = p.model;
    }
    this._aiForm = form;
    this._aiEditing = true;
    this.setData({ ai: aiView(a.data, form, { open: true, msg: '', busy: a.busy }) });
  },
  onAiField(e) {
    const k = e.currentTarget.dataset.k;
    const v = e.detail.value;
    if (!this._aiForm) this._aiForm = Object.assign({}, (this.data.ai && this.data.ai.form) || {});
    this._aiForm[k] = v;
    if (k === 'key') this._aiKey = v;
    this._aiEditing = true;
    // 不 setData，避免安卓输入法错位
    if (this.data.ai && this.data.ai.form) this.data.ai.form[k] = v;
  },
  aiFormNow() {
    const a = this.data.ai || {};
    const form = Object.assign({}, this._aiForm || a.form || {});
    if (this._aiKey != null && this._aiKey !== undefined) form.key = this._aiKey;
    return form;
  },
  onAiTest() {
    const a = this.data.ai || {};
    if (a.busy) return;
    const form = this.aiFormNow();
    this.setData({ 'ai.busy': 'test', 'ai.msg': '' });
    this.aiCall('test', form).then(r => {
      const ok = !!r.ok;
      const msg = ok
        ? ('接通了，用时 ' + (r.ms / 1000).toFixed(1) + ' 秒，它回复：「' + (r.reply || '') + '」')
        : ('没接通：' + (r.error || r.message || '请稍后再试'));
      // 测试不改配置，用当前状态刷新缓存时间；不要把测试返回值写进去（里面没有 status）
      if (a.data) writeAICache(a.data);
      this.setData({ ai: aiView(a.data, form, { open: true, busy: '', msg: msg, ok: ok }) });
    }).catch(e => {
      this.setData({ ai: aiView(a.data, form, { open: true, busy: '', msg: e.message, ok: false }) });
    });
  },
  onAiSave() {
    const a = this.data.ai || {};
    if (a.busy) return;
    const form = this.aiFormNow();
    this.setData({ 'ai.busy': 'save', 'ai.msg': '' });
    this.aiCall('save', form).then(r => {
      this._aiKey = '';
      this._aiForm = null;
      this._aiEditing = false;
      writeAICache(r);
      this.setData({ ai: aiView(r, { provider: r.provider, base_url: r.base_url, model: r.model, key: '' }, { open: false, msg: '', ok: true }) });
      this.toast('已保存，之后的回信用你自己的 AI 写');
    }).catch(e => {
      this.setData({ ai: aiView(a.data, form, { open: true, busy: '', msg: e.message, ok: false }) });
    });
  },
  onAiOff() {
    wx.showModal({
      title: '停用自己的 AI，改回免费模型？',
      content: '保存的 Key 会被删除。',
      confirmText: '停用',
      confirmColor: '#C0352B',
      success: (res) => {
        if (!res.confirm) return;
        this.aiCall('off').then(r => {
          this._aiKey = '';
          this._aiForm = null;
          this._aiEditing = false;
          writeAICache(r);
          this.setData({ ai: aiView(r, null, { open: false }) });
          this.toast('已改回免费模型');
        }).catch(e => this.toast(e.message));
      },
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
            clearStatusCaches();
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

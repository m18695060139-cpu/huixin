// 设置页共用：AI / API 状态缓存与展示。只缓存服务商、模型、是否已接入、Key 尾号；永远不存 Key 本身。

const { AI_ENABLED } = require('../config');

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

const KEY_RISK = '有了这串密钥，就能读到你全部的信、待办、点子和习惯。只交给你信任的 agent，别发给别人；担心泄露就点作废。接口只能读，不能改。';
const KEY_HIDDEN = '你的密钥（只在生成时显示过，忘了就重新生成）';

const AI_CACHE = 'hx_mp_ai_status';
const KEY_CACHE = 'hx_mp_api_status';
const STATUS_FRESH_MS = 60000;

function providerList(P) {
  const src = P || AI_PROVIDERS;
  return AI_IDS.map(id => {
    const p = src[id] || AI_PROVIDERS[id];
    return { id: id, name: p.name, base: p.base || '', model: p.model || '' };
  });
}

function providerName(id) {
  const p = AI_PROVIDERS[id] || AI_PROVIDERS.custom;
  return p.name;
}

function aiView(d, form, extra) {
  const P = (d && d.providers) || AI_PROVIDERS;
  const list = providerList(P);
  const configured = !!(d && d.configured);
  const f = form || {};
  const inUseId = configured ? (d.provider || 'custom') : 'hunyuan';
  const selectedId = f.provider || inUseId;
  const showForm = selectedId !== 'hunyuan';
  const pid = showForm ? selectedId : (configured ? (d.provider || 'custom') : 'deepseek');
  const pre = P[pid] || AI_PROVIDERS[pid] || AI_PROVIDERS.deepseek;
  const idx = Math.max(0, AI_IDS.indexOf(pid));
  const last4 = (d && d.last4) || '';
  const hunyuan = {
    id: 'hunyuan',
    name: '微信云开发的混元（免费，默认）',
    on: inUseId === 'hunyuan',
    pending: false,
  };
  const providers = [hunyuan].concat(list.map(x => Object.assign({}, x, {
    on: inUseId === x.id,
    pending: selectedId === x.id && inUseId !== x.id,
  })));
  return Object.assign({
    loading: false,
    error: '',
    configured: configured,
    provider: configured ? d.provider : '',
    providerName: configured ? ((P[d.provider] || P.custom || AI_PROVIDERS.custom).name) : '',
    model: configured ? (d.model || '') : '',
    last4: last4,
    providers: providers,
    showForm: showForm,
    providerNames: list.map(x => x.name),
    providerIndex: idx,
    formProviderName: (P[pid] || pre).name,
    form: {
      provider: showForm ? selectedId : (configured ? (d.provider || '') : ''),
      base_url: f.base_url != null ? f.base_url : (showForm ? ((d && configured && d.provider === selectedId && d.base_url) || pre.base || '') : ''),
      model: f.model != null ? f.model : (showForm ? ((d && configured && d.provider === selectedId && d.model) || pre.model || '') : ''),
      key: f.key || '',
    },
    keyPlaceholder: (configured && selectedId === inUseId) ? ('已保存（尾号 ' + last4 + '），不改就留空') : '粘贴服务商给你的 Key',
    open: !!(extra && extra.open),
    busy: (extra && extra.busy) || '',
    msg: (extra && extra.msg) || '',
    ok: !!(extra && extra.ok),
    data: d || { configured: false, providers: P },
  }, extra && extra.patch || {});
}

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

function bjTime(iso) {
  const t = new Date(iso).getTime();
  if (!iso || isNaN(t)) return '';
  const d = new Date(t + 8 * 3600e3).toISOString();
  return Number(d.slice(5, 7)) + '月' + Number(d.slice(8, 10)) + '日 ' + d.slice(11, 16);
}

function keyView(r, fresh) {
  return {
    loading: false,
    error: '',
    doc: r.exists ? keyDoc(r.url || '', fresh) : '',
    exists: !!r.exists,
    hint: r.hint || '',
    createdText: bjTime(r.created_at),
    usedText: r.last_used_at ? '最近使用 ' + bjTime(r.last_used_at) : '还没用过',
    fresh: fresh || '',
  };
}

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
  if (s) writeStore(AI_CACHE, s);
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
  if (s) writeStore(KEY_CACHE, s);
  return s;
}
function readKeyCache() { return keyStatusSafe(readStore(KEY_CACHE)); }

function aiRowValue() {
  if (!AI_ENABLED) return '';
  const c = readAICache();
  if (!c) return '混元（默认）';
  if (c.configured) return providerName(c.provider) || '已接入';
  return '混元（默认）';
}
function keyRowValue() {
  const c = readKeyCache();
  if (!c) return '未生成';
  return c.exists ? '已生成' : '未生成';
}

function callCloud(name, data) {
  return new Promise((resolve, reject) => {
    if (!wx.cloud) { reject(new Error('云端还没连上')); return; }
    wx.cloud.callFunction({
      name: name,
      data: data || {},
      success: (res) => resolve((res && res.result) || {}),
      fail: () => reject(new Error('云端还没连上，请稍后再试')),
    });
  });
}

function aiCall(action, body) {
  return callCloud('aiConfig', Object.assign({ action: action }, body || {})).then(r => {
    if (action === 'test') return r;
    if (r.ok) return r;
    throw new Error(r.message || '没办成，请稍后再试');
  }).catch(e => {
    if (/云端还没连上/.test(e.message)) {
      throw new Error('云端还没连上。请先在开发者工具里上传并部署 aiConfig');
    }
    throw e;
  });
}

function keyCall(action) {
  return callCloud('api', { action: action }).then(r => {
    if (r.ok) return r;
    throw new Error(r.message || '没办成，请稍后再试');
  });
}

function refreshAIIfStale() {
  if (!AI_ENABLED) return Promise.resolve(readAICache());
  const cached = readAICache();
  if (isFresh(cached)) return Promise.resolve(cached);
  return aiCall('status').then(r => writeAICache(r)).catch(() => cached);
}

function refreshKeyIfStale() {
  const cached = readKeyCache();
  if (isFresh(cached)) return Promise.resolve(cached);
  return keyCall('status').then(r => writeKeyCache(r)).catch(() => cached);
}

module.exports = {
  AI_ENABLED, AI_PROVIDERS, AI_HELP, AI_IDS,
  KEY_RISK, KEY_HIDDEN,
  providerList, providerName, aiView, keyDoc, keyView, bjTime,
  clearStatusCaches, writeAICache, readAICache, isFresh,
  writeKeyCache, readKeyCache,
  aiRowValue, keyRowValue,
  aiCall, keyCall, refreshAIIfStale, refreshKeyIfStale,
};

// 设置里的「自己的 AI」：查看、保存、测试、停用。
// 库里只存加密后的 Key，返回给小程序的永远只有后 4 位。集合 ai_config 应设为「所有用户不可读写」。
const cloud = require('wx-server-sdk');
const { PROVIDERS, testAI } = require('./openai');
const { encryptKey, decryptKey } = require('./secret');

cloud.init({ env: 'huixin-d1g2tdmkz68dc5a5d', timeout: 60000 });
const db = cloud.database();
const COLL = 'ai_config';

function fail(message, code) {
  return { ok: false, code: code || 'error', message: message };
}

function providersOut() {
  const out = {};
  Object.keys(PROVIDERS).forEach((k) => {
    const p = PROVIDERS[k];
    out[k] = { name: p.name, base: p.base, model: p.model };
  });
  return out;
}

async function mine(openid) {
  try {
    const res = await db.collection(COLL).where({ _openid: openid }).limit(5).get();
    return res.data || [];
  } catch (e) {
    return [];
  }
}

async function statusOf(openid) {
  const rows = await mine(openid);
  const row = rows[0];
  if (!row) return { ok: true, configured: false, providers: providersOut() };
  return {
    ok: true,
    configured: true,
    provider: row.provider,
    base_url: row.base_url,
    model: row.model,
    last4: row.key_last4,
    updated_at: row.updated_at,
    providers: providersOut(),
  };
}

// 校验提交；Key 留空表示沿用已保存的。永远不把 Key 写进返回值以外的地方。
async function readIn(openid, body) {
  const provider = PROVIDERS[body.provider] ? body.provider : 'custom';
  const baseUrl = String(body.base_url || (PROVIDERS[provider] || {}).base || '').trim();
  const model = String(body.model || '').trim();
  let key = String(body.key || '').trim();
  let keyEnc = null;
  let keyChanged = !!key;
  if (!/^https:\/\/[^\s]+$/i.test(baseUrl)) {
    return { error: '接口地址要以 https:// 开头' };
  }
  if (!model) return { error: '请填写模型名' };
  if (!key) {
    const rows = await mine(openid);
    if (!rows[0] || !rows[0].key_enc) return { error: '请填写 API Key' };
    keyEnc = rows[0].key_enc;
    try { key = decryptKey(keyEnc); }
    catch (e) { return { error: '已保存的 Key 解不开，请重新填写' }; }
  }
  if (key.length < 8) return { error: 'API Key 看起来不完整' };
  return { provider: provider, baseUrl: baseUrl, model: model.slice(0, 120), key: key, keyEnc: keyEnc, keyChanged: keyChanged };
}

async function save(openid, body) {
  const cfg = await readIn(openid, body);
  if (cfg.error) return fail(cfg.error, 'bad');
  try { await db.createCollection(COLL); } catch (e) { /* 已经有了 */ }
  const keyEnc = cfg.keyChanged ? encryptKey(cfg.key) : cfg.keyEnc;
  const last4 = cfg.key.slice(-4);
  const now = new Date().toISOString();
  const rows = await mine(openid);
  const data = {
    _openid: openid,
    provider: cfg.provider,
    base_url: cfg.baseUrl,
    model: cfg.model,
    key_enc: keyEnc,
    key_last4: last4,
    updated_at: now,
  };
  if (rows[0]) {
    await db.collection(COLL).doc(rows[0]._id).update({
      data: {
        provider: data.provider,
        base_url: data.base_url,
        model: data.model,
        key_enc: data.key_enc,
        key_last4: data.key_last4,
        updated_at: data.updated_at,
      },
    });
  } else {
    await db.collection(COLL).add({ data: data });
  }
  return statusOf(openid);
}

async function test(openid, body) {
  const cfg = await readIn(openid, body);
  if (cfg.error) return fail(cfg.error, 'bad');
  try {
    const r = await testAI({ baseUrl: cfg.baseUrl, model: cfg.model, key: cfg.key });
    return { ok: true, reply: r.reply, ms: r.ms };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) };
  }
}

async function off(openid) {
  const rows = await mine(openid);
  await Promise.all(rows.map((r) => db.collection(COLL).doc(r._id).remove()));
  return statusOf(openid);
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return fail('没有微信身份', 'auth');
  const action = event && event.action;
  try {
    if (action === 'status') return await statusOf(OPENID);
    if (action === 'save') return await save(OPENID, event);
    if (action === 'test') return await test(OPENID, event);
    if (action === 'off') return await off(OPENID);
    return fail('不认识的操作', 'bad');
  } catch (e) {
    console.error('aiConfig', action, e && e.message);
    return fail('没办成，请稍后再试');
  }
};

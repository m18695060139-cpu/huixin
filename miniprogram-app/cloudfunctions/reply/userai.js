// 读出当前用户自己的 AI，调不通再改用混元。和网页版 engines() 的回退顺序一致。
const { callOpenAI, providerLabel } = require('./openai');
const { decryptKey } = require('./secret');

const COLL = 'ai_config';

async function loadUserAI(db, openid) {
  try {
    const res = await db.collection(COLL).where({ _openid: openid }).limit(1).get();
    const row = (res.data && res.data[0]) || null;
    if (!row || !row.key_enc) return null;
    return {
      baseUrl: row.base_url,
      model: row.model,
      key: decryptKey(row.key_enc),
      label: providerLabel(row.provider),
    };
  } catch (e) {
    console.error('读取用户 AI 配置失败', e && e.message);
    return null;
  }
}

async function callOwn(cfg, messages, maxTokens, temperature, timeoutMs) {
  let r = await callOpenAI(cfg, messages, maxTokens, temperature, timeoutMs);
  if (r.finish === 'length') {
    try {
      const r2 = await callOpenAI(cfg, messages, Math.min(maxTokens * 2, 8000), temperature, Math.min(timeoutMs, 20000));
      if (r2.txt.length > r.txt.length) r = r2;
    } catch (e) { /* 沿用第一次 */ }
  }
  if (!r.txt) throw new Error('模型没有返回内容');
  return r.txt;
}

// hunyuanFn(messages) → { text, model }
// 自己的 AI 不论是连不上还是返回格式不对，都记下原因，再改用混元，不漏回信。
async function askWithUserAI(db, openid, messages, hunyuanFn, opts) {
  const opt = opts || {};
  const maxTokens = opt.maxTokens || 4000;
  const temperature = opt.temperature == null ? 0.6 : opt.temperature;
  const timeoutMs = opt.timeoutMs || 35000;
  const userAI = await loadUserAI(db, openid);
  let ownError;
  if (userAI) {
    try {
      const text = await callOwn(userAI, messages, maxTokens, temperature, timeoutMs);
      return { text: text, engine: userAI.label };
    } catch (e) {
      ownError = String(e && e.message || e);
    }
  }
  try {
    const asked = await hunyuanFn(messages);
    return { text: asked.text, engine: '混元 ' + asked.model, ownError: ownError };
  } catch (e) {
    if (ownError) {
      throw new Error('你自己的 AI 没接通（' + ownError + '），免费模型也没写成：' + String(e && e.message || e));
    }
    throw e;
  }
}

module.exports = { loadUserAI, askWithUserAI, COLL };

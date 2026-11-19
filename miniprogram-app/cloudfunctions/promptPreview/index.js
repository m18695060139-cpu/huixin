// 只给体验版对比新旧说法。不读别人的信，不写信件、待办、点子或总结。没有定时器。
const cloud = require('wx-server-sdk');
const { guard, guardAI } = require('./sec');
const { pairFor } = require('./preview');
const { normalizeReply } = require('./reply-source');

cloud.init({ env: 'huixin-d1g2tdmkz68dc5a5d', timeout: 60000 });
const db = cloud.database();

const HUNYUAN_MODEL = 'hy3';
const HUNYUAN_FALLBACK = 'hy3-preview';

function fail(message, code) {
  return { ok: false, code: code || 'ai', message: message, saved: false };
}

function textOf(res) {
  if (!res) return '';
  if (typeof res.text === 'string' && res.text.trim()) return res.text.trim();
  const choice = res.choices && res.choices[0];
  if (choice && choice.message && choice.message.content) return String(choice.message.content).trim();
  return '';
}

async function generate(messages, modelName, temperature) {
  if (typeof cloud.ai !== 'function') throw new Error('云函数里没有 cloud.ai()');
  const model = cloud.ai().createModel('cloudbase');
  const res = await model.generateText({
    model: modelName,
    messages: messages,
    temperature: temperature,
  }, { timeout: 25000 });
  if (res && res.error) throw res.error;
  const txt = textOf(res);
  if (!txt) throw new Error('混元没有返回内容');
  return txt;
}

function askHunyuan(temperature) {
  return async function (messages) {
    try {
      return { text: await generate(messages, HUNYUAN_MODEL, temperature), model: HUNYUAN_MODEL };
    } catch (e) {
      const msg = String(e && (e.message || e.errMsg) || e);
      if (/quota|额度|token|429|exhaust/i.test(msg)) throw e;
      return { text: await generate(messages, HUNYUAN_FALLBACK, temperature), model: HUNYUAN_FALLBACK };
    }
  };
}

function parseJSON(s) {
  try { return JSON.parse(s); } catch (e) { return null; }
}

function extractJSON(txt) {
  const s = String(txt || '').replace(/^```(?:json)?/i, '').replace(/```$/, '');
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  const j = a >= 0 && b > a ? parseJSON(s.slice(a, b + 1)) : null;
  if (!j) throw new Error('AI 返回的格式不对');
  return j;
}

function replyParts(made) {
  return [made.summary].concat(
    (made.tasks || []).map(t => t.text),
    (made.ideas || []).map(t => t.text),
    [made.lenses.health, made.lenses.energy, made.lenses.career, made.lenses.relation]
  );
}

function digestParts(content) {
  return [content.letter, content.title, content.energy_note, content.next].concat(content.forgotten || [], content.themes || []);
}

function allowed(openid) {
  const list = String(process.env.PROMPT_PREVIEW_OPENIDS || '').split(',').map(s => s.trim()).filter(Boolean);
  return list.indexOf(openid) >= 0;
}

async function oneSide(messages, openid, kind, opts) {
  const asked = await askHunyuan(opts.temperature)(messages);
  const body = kind === 'reply' ? normalizeReply(asked.text) : extractJSON(asked.text);
  const parts = kind === 'reply' ? replyParts(body) : digestParts(body);
  const sec = await guardAI(openid, parts);
  if (!sec.ok) {
    return { blocked: true, code: sec.code, engine: asked.engine || '' };
  }
  return { blocked: false, engine: asked.engine || '', body: body };
}

exports.main = async (event) => {
  const ctx = cloud.getWXContext();
  const openid = ctx && ctx.OPENID;
  if (!openid) return fail('没有微信身份', 'auth');
  if (!allowed(openid)) {
    const configured = String(process.env.PROMPT_PREVIEW_OPENIDS || '').trim();
    if (!configured) {
      return Object.assign(fail('还没有允许试用的身份。请在云函数环境变量 PROMPT_PREVIEW_OPENIDS 里填下面这一串，不要写进仓库。', 'unconfigured'), { yourOpenId: openid });
    }
    return fail('这个对比只给已允许的身份。', 'forbidden');
  }
  const pair = pairFor(event || {});
  if (!pair) return fail('没有这个对比样本', 'bad');
  try {
    const found = await db.collection('settings').where({ _openid: openid }).limit(1).get();
    const settings = (found.data && found.data[0]) || {};
    if (settings.ai_reply !== true) {
      return fail('智能回信还没打开。到「设置 → 智能回信」打开后再试。', 'off');
    }
    const material = pair.oldMessages[1].content;
    const inputSec = await guard(openid, [material]);
    if (!inputSec.ok) return fail('这段材料没通过安全检查，这次不比较。', 'risky');
    const opts = pair.kind === 'reply'
      ? { maxTokens: 4000, temperature: 0.5, timeoutMs: 15000 }
      : { maxTokens: pair.id === 'week' ? 3000 : 4500, temperature: 0.6, timeoutMs: 15000 };
    const both = await Promise.all([
      oneSide(pair.oldMessages, openid, pair.kind, opts),
      oneSide(pair.newMessages, openid, pair.kind, opts),
    ]);
    return {
      ok: true,
      saved: false,
      fixture: pair.id,
      kind: pair.kind,
      old: both[0],
      new: both[1],
    };
  } catch (e) {
    console.error(e);
    return fail('这次对比没写成。信、待办和总结都没有改。', 'ai');
  }
};

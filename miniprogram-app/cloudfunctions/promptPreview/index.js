// 只给体验版对比新旧说法。不读别人的信，不写信件、待办、点子或总结。没有定时器。
const cloud = require('wx-server-sdk');
const { guard, guardAI, checkText, classifySec, publicErrCode } = require('./sec');
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

function quotaError(e) {
  return /quota|额度|token|429|exhaust/i.test(String(e && (e.message || e.errMsg) || e));
}

// 两边必须同一模型。一边 hy3 成功、另一边掉到 hy3-preview 时，整次作废并两边改用同一个回退模型重试。
async function generatePair(oldMessages, newMessages, temperature) {
  try {
    const texts = await Promise.all([
      generate(oldMessages, HUNYUAN_MODEL, temperature),
      generate(newMessages, HUNYUAN_MODEL, temperature),
    ]);
    return { model: HUNYUAN_MODEL, texts: texts };
  } catch (e) {
    if (quotaError(e)) throw e;
    const texts = await Promise.all([
      generate(oldMessages, HUNYUAN_FALLBACK, temperature),
      generate(newMessages, HUNYUAN_FALLBACK, temperature),
    ]);
    return { model: HUNYUAN_FALLBACK, texts: texts };
  }
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

const SEC_PROBE = '合成检查。';

function secMessage(status, errCode) {
  if (status === 'accepted') return '内容接口可用。';
  if (status === 'risky') return '内容接口返回了风险，没有通过。';
  if (status === 'review') return '内容接口返回了复核，没有通过。';
  if (errCode === 45009) return '内容接口额度用尽。';
  if (errCode === -604101 || errCode === 604101) return '内容接口没有调用权限。';
  return '内容接口没有连上。';
}

async function runSecProbe(openid) {
  const judged = classifySec(await checkText(openid, SEC_PROBE));
  const out = {
    ok: judged.status === 'accepted',
    diagnostic: 'sec',
    saved: false,
    status: judged.status,
    message: secMessage(judged.status, judged.errCode),
  };
  if (judged.status === 'unchecked') out.errCode = judged.errCode;
  return out;
}

async function finishSide(text, model, openid, kind) {
  const body = kind === 'reply' ? normalizeReply(text) : extractJSON(text);
  const parts = kind === 'reply' ? replyParts(body) : digestParts(body);
  const sec = await guardAI(openid, parts);
  if (!sec.ok) {
    const out = { blocked: true, code: sec.code, engine: '混元 ' + model };
    if (sec.code === 'unchecked') out.errCode = publicErrCode(sec.errCode);
    return out;
  }
  return { blocked: false, engine: '混元 ' + model, body: body };
}

exports.main = async (event) => {
  const ctx = cloud.getWXContext() || {};
  const openid = ctx.OPENID;
  if (typeof openid !== 'string' || !openid) return fail('没有微信身份', 'auth');
  // 只回报本次调用者自己的身份，方便原样贴进环境变量。
  // 不读名单、不读库、不查内容、不调用模型，也不接受 event 里指定的别人。对比仍要先通过允许名单。
  if (event && event.action === 'whoami') {
    const out = { ok: true, diagnostic: true, saved: false, openid: openid };
    if (typeof ctx.APPID === 'string' && ctx.APPID) out.appid = ctx.APPID;
    if (typeof ctx.ENV === 'string' && ctx.ENV) out.env = ctx.ENV;
    return out;
  }
  if (!allowed(openid)) {
    const configured = String(process.env.PROMPT_PREVIEW_OPENIDS || '').trim();
    if (!configured) {
      return Object.assign(fail('还没有允许试用的身份。请在云函数环境变量 PROMPT_PREVIEW_OPENIDS 里填下面这一串，不要写进仓库。', 'unconfigured'), { yourOpenId: openid });
    }
    return fail('这个对比只给已允许的身份。', 'forbidden');
  }
  if (event && event.action === 'seccheck') return runSecProbe(openid);
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
    if (!inputSec.ok && inputSec.code === 'unchecked') {
      return Object.assign(fail('内容安全检查暂时没连上，这次不比较。', 'unchecked'), { errCode: publicErrCode(inputSec.errCode) });
    }
    if (!inputSec.ok) return fail('这段材料没通过安全检查，这次不比较。', 'risky');
    const opts = pair.kind === 'reply'
      ? { maxTokens: 4000, temperature: 0.5, timeoutMs: 15000 }
      : { maxTokens: pair.id === 'week' ? 3000 : 4500, temperature: 0.6, timeoutMs: 15000 };
    const generated = await generatePair(pair.oldMessages, pair.newMessages, opts.temperature);
    const both = await Promise.all([
      finishSide(generated.texts[0], generated.model, openid, pair.kind),
      finishSide(generated.texts[1], generated.model, openid, pair.kind),
    ]);
    const comparable = both[0].engine === both[1].engine;
    if (!comparable) return fail('两边用的模型不一致，这次对比作废。', 'model');
    return {
      ok: true,
      saved: false,
      comparable: true,
      model: generated.model,
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

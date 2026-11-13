// 把口授稿整理成通顺的日记。优先用用户自己的 AI（15 秒），调不通再改用混元。总时长控制在 60 秒内。
const cloud = require('wx-server-sdk');
const { guard } = require('./sec');
const { askWithUserAI } = require('./userai');

cloud.init({
  env: 'huixin-d1g2tdmkz68dc5a5d',
  timeout: 60000,
});
const db = cloud.database();

const HUNYUAN_MODEL = 'hy3';
const HUNYUAN_FALLBACK = 'hy3-preview';

const SYSTEM = [
  '你在整理一封写给自己的日记口授稿。只做这些事：',
  '补上合适的标点，分成自然的句子和段落；',
  '去掉口语填充词（嗯、啊、那个、就是、然后等反复的口头禅），句子仍要通顺；',
  '纠正明显的同音错字，以上下文为准。',
  '不要改变原意，不要增添原话里没有的内容，不要删掉有意义的细节。',
  '不要改成第三人称，保持第一人称、像在写给自己的日记。',
  '只返回整理后的正文，不要解释，不要加标题或引号。',
].join('');

function textOf(res) {
  if (!res) return '';
  if (typeof res.text === 'string' && res.text.trim()) return res.text.trim();
  const choice = res.choices && res.choices[0];
  if (choice && choice.message && choice.message.content) return String(choice.message.content).trim();
  return '';
}

async function generate(messages, modelName) {
  if (typeof cloud.ai !== 'function') throw new Error('云函数里没有 cloud.ai()');
  const model = cloud.ai().createModel('cloudbase');
  const res = await model.generateText({
    model: modelName,
    messages: messages,
    temperature: 0.2,
  }, { timeout: 35000 });
  if (res && res.error) throw res.error;
  const txt = textOf(res);
  if (!txt) throw new Error('混元没有返回内容');
  return txt;
}

async function askHunyuan(messages) {
  try {
    return { text: await generate(messages, HUNYUAN_MODEL), model: HUNYUAN_MODEL };
  } catch (e) {
    const msg = String(e && (e.message || e.errMsg) || e);
    if (/quota|额度|token|429|exhaust/i.test(msg)) throw e;
    console.error('hy3 失败，改试', HUNYUAN_FALLBACK, msg);
    return { text: await generate(messages, HUNYUAN_FALLBACK), model: HUNYUAN_FALLBACK };
  }
}

function stripFence(s) {
  let t = String(s || '').trim();
  t = t.replace(/^```(?:\w+)?\s*/, '').replace(/\s*```$/, '');
  return t.trim();
}

function friendly(e) {
  const msg = String(e && (e.message || e.errMsg) || e || '');
  if (/你自己的 AI 没接通/.test(msg)) return msg;
  if (/quota|额度|token|429|exhaust|欠费/i.test(msg)) return '今天的免费额度用完了，稍后再试。';
  return '整理这次没写成，稍后再试。';
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { ok: false, code: 'auth', message: '没有微信身份' };
  const text = String((event && event.text) || '').trim();
  if (!text) return { ok: false, code: 'empty', message: '没有要整理的文字' };
  if (text.length > 8000) return { ok: false, code: 'long', message: '这段太长了，请分段整理' };

  const secIn = await guard(OPENID, [text]);
  if (secIn && secIn.ok === false) {
    return { ok: false, code: 'risky', message: '这段内容没通过检查，换个说法再试' };
  }

  const messages = [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: text },
  ];
  try {
    const asked = await askWithUserAI(db, OPENID, messages, askHunyuan, {
      maxTokens: 3000,
      temperature: 0.2,
      timeoutMs: 15000,
    });
    const out = stripFence(asked.text);
    if (!out) return { ok: false, message: '模型没有返回内容' };
    const secOut = await guard(OPENID, [out]);
    if (secOut && secOut.ok === false) {
      return { ok: false, code: 'risky', message: '整理结果没通过检查，原文还在' };
    }
    return { ok: true, text: out, engine: asked.engine };
  } catch (e) {
    return { ok: false, message: friendly(e) };
  }
};

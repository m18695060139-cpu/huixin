// 寄出或拆开时写回信。优先用用户自己接的 OpenAI 兼容接口，调不通再改用混元。
// 提示词只在这个函数里。周信、季信、年信在 cloudfunctions/digest。
const cloud = require('wx-server-sdk');
const { guard } = require('./sec');
const { HUNYUAN_MODEL, HUNYUAN_FALLBACK, DEFAULT_QUESTIONS, buildMessages, normalizeReply } = require('./prompt');
const { askWithUserAI } = require('./userai');

cloud.init({
  env: 'huixin-d1g2tdmkz68dc5a5d',
  timeout: 60000,
});
const db = cloud.database();

function fail(message, code) {
  return { ok: false, code: code || 'ai', message: message };
}

function isDate(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
}

function addDays(s, n) {
  const d = new Date(s + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  const p = x => (x < 10 ? '0' : '') + x;
  return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate());
}

function cstToday() {
  const d = new Date(Date.now() + 8 * 3600e3);
  const p = x => (x < 10 ? '0' : '') + x;
  return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate());
}

function norm(s) {
  return String(s || '').toLowerCase().replace(/[\s.,，。！？、；;:："'“”‘’（）()【】\[\]·\-—]/g, '');
}

function uid(prefix) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function stillSealed(letter, deliver) {
  if (deliver === 'now' || !letter || letter.opened) return false;
  if (!letter.reply || letter.reply.imported) return false;
  const stamp = new Date(letter.replied_at || Date.now()).getTime();
  if (isNaN(stamp)) return false;
  const next = addDays(letter.date, 1);
  const cutoff = new Date(next + 'T04:00:00+08:00').getTime();
  const deliverAt = new Date(next + 'T06:00:00+08:00').getTime();
  if (!(stamp < cutoff)) return false;
  return Date.now() < deliverAt;
}

async function findOne(coll, openid, match) {
  const res = await db.collection(coll).where(Object.assign({ _openid: openid }, match)).limit(1).get();
  return (res.data && res.data[0]) || null;
}

async function listOwn(coll, openid, limit) {
  try {
    const res = await db.collection(coll).where({ _openid: openid }).limit(limit || 100).get();
    return res.data || [];
  } catch (e) {
    return [];
  }
}

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
    temperature: 0.5,
  }, { timeout: 50000 });
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

function friendly(e) {
  const msg = String(e && (e.message || e.errMsg) || e || '');
  if (/你自己的 AI 没接通/.test(msg)) return msg + ' 你写的信还在。';
  if (/quota|额度|token|429|exhaust|欠费/i.test(msg)) return '今天的免费额度用完了，明天再拆一次。你写的信还在。';
  return '回信这次没写成，稍后再试。你写的信还在。';
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return fail('没有微信身份', 'auth');
  const date = event && event.date;
  if (!isDate(date)) return fail('日期不对', 'bad');
  try {
    const letter = await findOne('letters', OPENID, { date: date });
    if (!letter || !String(letter.text || '').trim()) return fail('这封信还是空的', 'empty');
    if (event && event.feedback && event.feedback.block) {
      const fbLetter = await findOne('letters', OPENID, { date: date });
      if (!fbLetter || !fbLetter.reply) return fail('还没有回信', 'empty');
      const reply = fbLetter.reply;
      const v = Number(event.feedback.value) || 0;
      reply.fb = v;
      await db.collection('letters').doc(fbLetter._id).update({ data: { reply: reply } });
      return { ok: true, reply: reply };
    }
    if (letter.reply && letter.reply.summary) {
      return { ok: true, reply: letter.reply, replied_at: letter.replied_at || '', cached: true, sealed: stillSealed(letter, (await findOne('settings', OPENID, {}) || {}).deliver) };
    }
    const settings = await findOne('settings', OPENID, {}) || {};

    const todos = await listOwn('todos', OPENID, 100);
    const ideas = await listOwn('ideas', OPENID, 100);
    const openTodos = todos.filter(t => !t.done && !t.archived && !t.dropped_at);
    const openIdeas = ideas.filter(i => i.status === 'open');
    const noted = todos.filter(t => t.note || t.dropped_at).slice(0, 15);
    const yday = await findOne('letters', OPENID, { date: addDays(date, -1) });
    const today = cstToday();
    const questions = (Array.isArray(settings.questions) && settings.questions.length) ? settings.questions : DEFAULT_QUESTIONS;
    const ctx = {
      name: settings.name || '',
      date: date,
      today: today,
      backfill: date !== today,
      text: letter.text,
      questions: questions,
      openTodos: openTodos.map(t => t.text),
      ideas: openIdeas.map(t => t.text),
      notes: noted.map(t => t.text + (t.dropped_at ? '【放下了】' : '【还在做】') + (t.note ? '：' + String(t.note).slice(0, 120) : '')),
      yesterday: yday && yday.reply && yday.reply.summary ? yday.reply.summary : '',
    };
    const asked = await askWithUserAI(db, OPENID, buildMessages(ctx), askHunyuan, { maxTokens: 4000, temperature: 0.5, timeoutMs: 35000 });
    const made = normalizeReply(asked.text);
    const parts = [made.summary].concat(made.tasks.map(t => t.text), made.ideas.map(t => t.text), [
      made.lenses.health, made.lenses.energy, made.lenses.career, made.lenses.relation,
    ]);
    const sec = await guard(OPENID, parts);
    if (!sec.ok) return fail('回信这次没能留下，稍后再拆一次。你写的信还在。', 'risky');

    const haveT = {};
    openTodos.concat(todos.filter(t => t.dropped_at)).forEach(t => { haveT[norm(t.text)] = true; });
    const haveI = {};
    openIdeas.forEach(t => { haveI[norm(t.text)] = true; });
    const madeTodos = openTodos.filter(t => t.source_date === date).map(t => ({
      id: t.id, text: t.text, due: t.due || '', source_date: date, created: t.created || date,
    }));
    const madeIdeas = openIdeas.filter(t => t.source_date === date).map(t => ({
      id: t.id, text: t.text, source_date: date, created: t.created || date,
    }));
    for (let i = 0; i < made.tasks.length; i++) {
      const task = made.tasks[i];
      const key = norm(task.text);
      if (!key || haveT[key]) continue;
      haveT[key] = true;
      const id = uid('t');
      const due = addDays(date, task.dueDays);
      const doc = {
        id: id, text: task.text, due: due, note: '', done: false, done_at: '', dropped_at: '',
        archived: false, source_date: date, created: date, updated_at: new Date().toISOString(), _openid: OPENID,
      };
      await db.collection('todos').add({ data: doc });
      madeTodos.push({ id: id, text: task.text, due: due, source_date: date, created: date });
    }
    for (let i = 0; i < made.ideas.length; i++) {
      const idea = made.ideas[i];
      const key = norm(idea.text);
      if (!key || haveI[key]) continue;
      haveI[key] = true;
      const id = uid('i');
      const doc = {
        id: id, text: idea.text, status: 'open', source_date: date, created: date, dropped_at: '',
        updated_at: new Date().toISOString(), _openid: OPENID,
      };
      await db.collection('ideas').add({ data: doc });
      madeIdeas.push({ id: id, text: idea.text, source_date: date, created: date });
    }
    const repliedAt = new Date().toISOString();
    const reply = {
      summary: made.summary,
      energy: made.energy,
      mood: made.mood,
      highlight: made.highlight,
      lenses: made.lenses,
      questions: questions,
      todos: madeTodos.map(t => ({ id: t.id, text: t.text, due: t.due || '' })),
      ideas: madeIdeas.map(t => ({ id: t.id, text: t.text })),
      engine: asked.engine || '',
    };
    if (asked.ownError) reply.ownError = asked.ownError;
    const patch = {
      reply: reply,
      replied_at: repliedAt,
      updated_at: repliedAt,
      mood: made.mood,
      energy: made.energy,
    };
    await db.collection('letters').doc(letter._id).update({ data: patch });
    return {
      ok: true,
      reply: reply,
      replied_at: repliedAt,
      todos: madeTodos,
      ideas: madeIdeas,
      sealed: stillSealed(Object.assign({}, letter, { reply: reply, replied_at: repliedAt }), settings.deliver),
    };
  } catch (e) {
    console.error(e);
    return fail(friendly(e), /quota|额度|429/.test(String(e && e.message || '')) ? 'quota' : 'ai');
  }
};

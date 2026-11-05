// 统一写入。先做内容安全检查，再按调用者的 openid 落库。
const cloud = require('wx-server-sdk');
const { guard } = require('./sec');

cloud.init({ env: 'huixin-d1g2tdmkz68dc5a5d' });
const db = cloud.database();

const MOODS = { '平静': 1, '专注': 1, '振奋': 1, '疲惫': 1, '焦虑': 1, '低落': 1, '烦躁': 1, '感激': 1 };
const THEMES = { auto: 1, ink: 1, night: 1, paper: 1, mono: 1 };

function fail(message, code) {
  return { ok: false, code: code || 'bad', message: message };
}

function isDate(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
}

function clip(s, n) {
  return String(s || '').slice(0, n);
}

function moodOf(v) {
  const s = String(v || '').trim();
  return MOODS[s] ? s : '';
}

function energyOf(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (n >= 1 && n <= 5) return Math.round(n);
  return null;
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return fail('没有微信身份', 'auth');
  const entity = event && event.entity;
  const action = event && event.action;
  const payload = (event && event.payload) || {};
  try {
    if (entity === 'letter') return await saveLetter(OPENID, payload);
    if (entity === 'todo') return await saveTodo(OPENID, action, payload);
    if (entity === 'idea') return await saveIdea(OPENID, action, payload);
    if (entity === 'habit') return await saveHabit(OPENID, payload);
    if (entity === 'habitLog') return await saveLog(OPENID, payload);
    if (entity === 'settings') return await saveSettings(OPENID, payload);
    return fail('不认识的数据');
  } catch (e) {
    console.error(e);
    return fail('保存失败，请稍后再试', 'error');
  }
};

async function find(coll, openid, match) {
  const res = await db.collection(coll).where(Object.assign({ _openid: openid }, match)).limit(1).get();
  return (res.data && res.data[0]) || null;
}

async function upsert(coll, openid, match, data) {
  const cur = await find(coll, openid, match);
  if (cur) {
    await db.collection(coll).doc(cur._id).update({ data: data });
    return cur._id;
  }
  const add = await db.collection(coll).add({ data: Object.assign({}, match, data, { _openid: openid }) });
  return add._id;
}

async function saveLetter(openid, payload) {
  if (!isDate(payload.date)) return fail('日期不对');
  const cur = await find('letters', openid, { date: payload.date }) || {};
  const text = ('text' in payload) ? clip(payload.text, 20000) : (cur.text || '');
  let review = !!cur.sec_review;
  let unchecked = !!cur.sec_unchecked;
  if ('text' in payload) {
    const g = await guard(openid, [text]);
    if (!g.ok) return g;
    review = !!g.review;
    unchecked = !!g.unchecked;
  }
  const data = {
    date: payload.date,
    text: text,
    mood: ('mood' in payload) ? moodOf(payload.mood) : (cur.mood || ''),
    energy: ('energy' in payload) ? energyOf(payload.energy) : (cur.energy == null ? null : cur.energy),
    sent_at: ('sent_at' in payload) ? clip(payload.sent_at, 40) : (cur.sent_at || ''),
    opened: ('opened' in payload) ? !!payload.opened : !!cur.opened,
    sec_review: review,
    sec_unchecked: unchecked,
    updated_at: new Date().toISOString(),
  };
  const _id = await upsert('letters', openid, { date: payload.date }, data);
  return { ok: true, _id: _id };
}

async function saveTodo(openid, action, payload) {
  const id = clip(payload.id, 40);
  if (!id) return fail('缺少待办');
  if (action === 'delete') {
    const cur = await find('todos', openid, { id: id });
    if (cur) await db.collection('todos').doc(cur._id).remove();
    return { ok: true };
  }
  const cur = await find('todos', openid, { id: id }) || {};
  const text = ('text' in payload) ? clip(payload.text, 200).trim() : (cur.text || '');
  const note = ('note' in payload) ? clip(payload.note, 500).trim() : (cur.note || '');
  if (!text) return fail('待办内容不能为空');
  const g = await guard(openid, [text, note]);
  if (!g.ok) return g;
  const due = payload.due && isDate(payload.due) ? payload.due : (('due' in payload) ? '' : (cur.due || ''));
  const data = {
    id: id,
    text: text,
    due: due,
    note: note,
    done: ('done' in payload) ? !!payload.done : !!cur.done,
    done_at: ('done_at' in payload) ? (isDate(payload.done_at) ? payload.done_at : '') : (cur.done_at || ''),
    dropped_at: ('dropped_at' in payload) ? (isDate(payload.dropped_at) ? payload.dropped_at : '') : (cur.dropped_at || ''),
    archived: ('archived' in payload) ? !!payload.archived : !!cur.archived,
    source_date: ('source_date' in payload) ? (isDate(payload.source_date) ? payload.source_date : '') : (cur.source_date || ''),
    created: isDate(payload.created) ? payload.created : (cur.created || payload.date || ''),
    sec_review: !!g.review,
    updated_at: new Date().toISOString(),
  };
  if (data.dropped_at) { data.done = false; data.done_at = ''; }
  const _id = await upsert('todos', openid, { id: id }, data);
  return { ok: true, _id: _id };
}

async function saveIdea(openid, action, payload) {
  const id = clip(payload.id, 40);
  if (!id) return fail('缺少点子');
  if (action === 'delete') {
    const cur = await find('ideas', openid, { id: id });
    if (cur) await db.collection('ideas').doc(cur._id).remove();
    return { ok: true };
  }
  const cur = await find('ideas', openid, { id: id }) || {};
  const text = ('text' in payload) ? clip(payload.text, 300).trim() : (cur.text || '');
  if (!text) return fail('点子内容不能为空');
  const g = await guard(openid, [text]);
  if (!g.ok) return g;
  const status = ['open', 'todo', 'dropped'].indexOf(payload.status) >= 0 ? payload.status : (cur.status || 'open');
  const data = {
    id: id,
    text: text,
    status: status,
    source_date: ('source_date' in payload) ? (isDate(payload.source_date) ? payload.source_date : '') : (cur.source_date || ''),
    created: isDate(payload.created) ? payload.created : (cur.created || ''),
    dropped_at: ('dropped_at' in payload) ? (isDate(payload.dropped_at) ? payload.dropped_at : '') : (cur.dropped_at || ''),
    sec_review: !!g.review,
    updated_at: new Date().toISOString(),
  };
  const _id = await upsert('ideas', openid, { id: id }, data);
  return { ok: true, _id: _id };
}

async function saveHabit(openid, payload) {
  const id = clip(payload.id, 40);
  if (!id) return fail('缺少习惯');
  const cur = await find('habits', openid, { id: id }) || {};
  const name = ('name' in payload) ? clip(payload.name, 30).trim() : (cur.name || '');
  if (!name) return fail('习惯名不能为空');
  if ('name' in payload) {
    const g = await guard(openid, [name]);
    if (!g.ok) return g;
  }
  const data = {
    id: id,
    name: name,
    sort: Number(payload.sort) || cur.sort || 0,
    archived: ('archived' in payload) ? !!payload.archived : !!cur.archived,
    created: isDate(payload.created) ? payload.created : (cur.created || ''),
    updated_at: new Date().toISOString(),
  };
  const _id = await upsert('habits', openid, { id: id }, data);
  return { ok: true, _id: _id };
}

async function saveLog(openid, payload) {
  if (!clip(payload.habit_id, 40) || !isDate(payload.date)) return fail('打卡参数不对');
  const habit = await find('habits', openid, { id: payload.habit_id });
  if (!habit) return fail('没有这个习惯');
  const res = await db.collection('habit_logs').where({
    _openid: openid, habit_id: payload.habit_id, date: payload.date,
  }).limit(20).get();
  const rows = res.data || [];
  if (!payload.done) {
    await Promise.all(rows.map(r => db.collection('habit_logs').doc(r._id).remove()));
    return { ok: true };
  }
  if (rows.length) return { ok: true, _id: rows[0]._id };
  const add = await db.collection('habit_logs').add({
    data: { habit_id: payload.habit_id, date: payload.date, done: true, _openid: openid },
  });
  return { ok: true, _id: add._id };
}

async function saveSettings(openid, payload) {
  const cur = await find('settings', openid, {}) || {};
  const parts = [];
  const data = {
    theme: THEMES[payload.theme] ? payload.theme : (THEMES[cur.theme] ? cur.theme : 'auto'),
    name: ('name' in payload) ? clip(payload.name, 20).trim() : (cur.name || ''),
    questions: Array.isArray(cur.questions) ? cur.questions : [],
    deliver: cur.deliver === 'now' ? 'now' : 'morning',
    updated_at: new Date().toISOString(),
  };
  if (payload.deliver === 'now' || payload.deliver === 'morning') data.deliver = payload.deliver;
  if ('name' in payload) parts.push(data.name);
  if (Array.isArray(payload.questions)) {
    const qs = payload.questions.map(s => clip(s, 120).trim()).filter(Boolean).slice(0, 10);
    if (!qs.length) return fail('至少留一个问题');
    data.questions = qs;
    parts.push.apply(parts, qs);
  }
  if (parts.length) {
    const g = await guard(openid, parts);
    if (!g.ok) return g;
    data.sec_review = !!g.review;
  }
  if ('theme' in payload && THEMES[payload.theme]) data.theme = payload.theme;
  const _id = cur._id
    ? (await db.collection('settings').doc(cur._id).update({ data: data }), cur._id)
    : (await db.collection('settings').add({ data: Object.assign({ _openid: openid }, data) }))._id;
  return { ok: true, _id: _id };
}

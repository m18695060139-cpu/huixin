// 从网页版导出的 JSON 导入。同一日期 / id 再导不会新增一份。
// 已经在小程序里的内容不覆盖、不删除；只补上还空着的字段（回信正文、replied_at、周信季信年信）。
const cloud = require('wx-server-sdk');
const { guard } = require('./sec');

cloud.init({ env: 'huixin-d1g2tdmkz68dc5a5d' });
const db = cloud.database();

const MOODS = { '平静': 1, '专注': 1, '振奋': 1, '疲惫': 1, '焦虑': 1, '低落': 1, '烦躁': 1, '感激': 1 };
const THEMES = { auto: 1, ink: 1, night: 1, paper: 1, mono: 1 };

function isDate(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
}
function clip(s, n) { return String(s == null ? '' : s).slice(0, n); }

function isEmpty(v) {
  if (v == null || v === '') return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'object') {
    if (Object.prototype.hasOwnProperty.call(v, 'summary')) return !String(v.summary || '').trim();
    return Object.keys(v).length === 0;
  }
  return false;
}

function unwrap(event) {
  let data = event && (event.data || event.bootstrap || event);
  if (data && data.bootstrap && typeof data.bootstrap === 'object') data = data.bootstrap;
  return data && typeof data === 'object' ? data : {};
}

function asList(v, keyField) {
  if (Array.isArray(v)) return v;
  if (v && typeof v === 'object') {
    return Object.keys(v).map(k => {
      const row = Object.assign({}, v[k]);
      if (keyField && !row[keyField]) row[keyField] = k;
      return row;
    });
  }
  return [];
}

async function loadRows(coll, openid) {
  const rows = [];
  let skip = 0;
  for (let n = 0; n < 30; n++) {
    let res;
    try {
      res = await db.collection(coll).where({ _openid: openid }).skip(skip).limit(100).get();
    } catch (e) {
      break;
    }
    const batch = (res && res.data) || [];
    batch.forEach(row => rows.push(row));
    if (batch.length < 100) break;
    skip += batch.length;
  }
  return rows;
}

function indexRows(rows, keyOf) {
  const map = {};
  const docs = {};
  rows.forEach(row => {
    const key = keyOf(row);
    if (!key || !row._id) return;
    map[key] = row._id;
    docs[key] = row;
  });
  return { map: map, docs: docs };
}

async function fillMissing(coll, openid, bag, key, data) {
  const id = bag.map[key];
  if (!id) {
    const add = await db.collection(coll).add({ data: Object.assign({ _openid: openid }, data) });
    bag.map[key] = add._id;
    bag.docs[key] = Object.assign({ _id: add._id }, data);
    return 'added';
  }
  const existing = bag.docs[key] || {};
  const patch = {};
  Object.keys(data).forEach(k => {
    if (isEmpty(existing[k]) && !isEmpty(data[k])) patch[k] = data[k];
  });
  if (!Object.keys(patch).length) return 'kept';
  await db.collection(coll).doc(id).update({ data: patch });
  Object.assign(existing, patch);
  return 'filled';
}

function cleanReply(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const summary = clip(raw.summary, 8000).trim();
  if (!summary) return null;
  const out = {
    summary: summary,
    mood: MOODS[raw.mood] ? raw.mood : '',
    highlight: clip(raw.highlight, 20),
    lenses: {},
    todos: [],
    ideas: [],
    engine: clip(raw.engine, 60),
    imported: true,
  };
  const energy = Number(raw.energy);
  if (energy >= 1 && energy <= 5) out.energy = Math.round(energy);
  const lenses = raw.lenses && typeof raw.lenses === 'object' ? raw.lenses : {};
  ['health', 'energy', 'career', 'relation'].forEach(k => {
    const text = clip(lenses[k], 800).trim();
    if (text) out.lenses[k] = text;
  });
  (Array.isArray(raw.todos) ? raw.todos : []).slice(0, 30).forEach(t => {
    if (!t || !String(t.text || '').trim()) return;
    out.todos.push({ id: clip(t.id, 40), text: clip(t.text, 200), due: isDate(t.due) ? t.due : '' });
  });
  (Array.isArray(raw.ideas) ? raw.ideas : []).slice(0, 30).forEach(t => {
    if (!t || !String(t.text || '').trim()) return;
    out.ideas.push({ id: clip(t.id, 40), text: clip(t.text, 300) });
  });
  return out;
}

function replyParts(reply) {
  return [reply.summary, reply.highlight].concat(
    reply.todos.map(t => t.text),
    reply.ideas.map(t => t.text),
    [reply.lenses.health, reply.lenses.energy, reply.lenses.career, reply.lenses.relation]
  );
}

function cleanDigest(row) {
  const src = row && row.content && typeof row.content === 'object' ? row.content : (row || {});
  const content = {};
  ['title', 'letter', 'energy_note', 'next', 'engine'].forEach(k => {
    const text = clip(src[k], 8000).trim();
    if (text) content[k] = text;
  });
  if (Array.isArray(src.forgotten)) content.forgotten = src.forgotten.map(s => clip(s, 200).trim()).filter(Boolean).slice(0, 8);
  if (Array.isArray(src.themes)) content.themes = src.themes.map(s => clip(s, 40).trim()).filter(Boolean).slice(0, 8);
  ['lenses', 'plans', 'stats'].forEach(k => {
    if (src[k] && typeof src[k] === 'object') content[k] = src[k];
  });
  if (Array.isArray(src.range)) content.range = src.range.slice(0, 2);
  if (!content.letter && !content.title) return null;
  return content;
}

function digestParts(content) {
  return [content.letter, content.title, content.energy_note, content.next].concat(content.forgotten || [], content.themes || []);
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { ok: false, code: 'auth', message: '没有微信身份' };
  const src = unwrap(event);
  const skipped = [];
  const imported = { letters: 0, replies: 0, todos: 0, ideas: 0, habits: 0, logs: 0, settings: 0, digests: 0 };
  try {
    const lettersBag = indexRows(await loadRows('letters', OPENID), row => row.date);
    const todosBag = indexRows(await loadRows('todos', OPENID), row => row.id);
    const ideasBag = indexRows(await loadRows('ideas', OPENID), row => row.id);
    const habitsBag = indexRows(await loadRows('habits', OPENID), row => row.id);
    const logsBag = indexRows(await loadRows('habit_logs', OPENID), row => row.key || (row.habit_id && row.date ? row.habit_id + '|' + row.date : ''));
    const digestsBag = indexRows(await loadRows('digests', OPENID), row => (row.kind && row.key) ? row.kind + '|' + row.key : '');

    const letters = asList(src.letters, 'date');
    for (let i = 0; i < letters.length; i++) {
      const row = letters[i] || {};
      if (!isDate(row.date)) continue;
      const text = clip(row.text, 20000);
      if (!String(text).trim()) continue;
      const existing = lettersBag.docs[row.date];
      const reply = cleanReply(row.reply);
      if (!existing) {
        const g = await guard(OPENID, [text].concat(reply ? replyParts(reply) : []));
        if (!g.ok) { skipped.push({ type: 'letter', key: row.date }); continue; }
        const mood = MOODS[row.mood] ? row.mood : (reply && MOODS[reply.mood] ? reply.mood : '');
        const energyRaw = row.energy != null ? row.energy : (reply && reply.energy);
        const energyNum = Number(energyRaw);
        const energy = energyNum >= 1 && energyNum <= 5 ? Math.round(energyNum) : null;
        const data = {
          date: row.date,
          text: text,
          mood: mood,
          energy: energy,
          sent_at: row.sent_at || row.updated_at || row.replied_at || new Date().toISOString(),
          opened: true,
          sec_review: !!g.review,
          sec_unchecked: !!g.unchecked,
          updated_at: new Date().toISOString(),
        };
        if (reply) {
          data.reply = reply;
          data.replied_at = row.replied_at || row.updated_at || '';
          imported.replies++;
        }
        await fillMissing('letters', OPENID, lettersBag, row.date, data);
        imported.letters++;
        continue;
      }
      if (reply && isEmpty(existing.reply)) {
        const g = await guard(OPENID, replyParts(reply));
        if (!g.ok) { skipped.push({ type: 'reply', key: row.date }); continue; }
        const patch = { reply: reply };
        if (isEmpty(existing.replied_at) && row.replied_at) patch.replied_at = row.replied_at;
        if (isEmpty(existing.mood) && reply.mood) patch.mood = reply.mood;
        if (isEmpty(existing.energy) && reply.energy) patch.energy = reply.energy;
        const how = await fillMissing('letters', OPENID, lettersBag, row.date, patch);
        if (how !== 'kept') imported.replies++;
      } else if (isEmpty(existing.replied_at) && row.replied_at && existing.reply && existing.reply.summary) {
        await fillMissing('letters', OPENID, lettersBag, row.date, { replied_at: row.replied_at });
      }
    }

    const todos = asList(src.todos, 'id');
    for (let i = 0; i < todos.length; i++) {
      const row = todos[i] || {};
      const id = clip(row.id, 40);
      const text = clip(row.text, 200).trim();
      if (!id || !text) continue;
      if (todosBag.map[id]) continue;
      const note = clip(row.note, 500).trim();
      const g = await guard(OPENID, [text, note]);
      if (!g.ok) { skipped.push({ type: 'todo', key: id }); continue; }
      await fillMissing('todos', OPENID, todosBag, id, {
        id: id,
        text: text,
        due: isDate(row.due) ? row.due : '',
        note: note,
        done: !!row.done && !row.dropped_at,
        done_at: isDate(row.done_at) ? row.done_at : '',
        dropped_at: isDate(row.dropped_at) ? row.dropped_at : '',
        archived: !!row.archived,
        source_date: isDate(row.source_date) ? row.source_date : '',
        created: isDate(row.created) ? row.created : '',
        sec_review: !!g.review,
        updated_at: new Date().toISOString(),
      });
      imported.todos++;
    }

    const ideas = asList(src.ideas, 'id');
    for (let i = 0; i < ideas.length; i++) {
      const row = ideas[i] || {};
      const id = clip(row.id, 40);
      const text = clip(row.text, 300).trim();
      if (!id || !text) continue;
      if (ideasBag.map[id]) continue;
      const g = await guard(OPENID, [text]);
      if (!g.ok) { skipped.push({ type: 'idea', key: id }); continue; }
      const status = ['open', 'todo', 'dropped'].indexOf(row.status) >= 0 ? row.status : 'open';
      await fillMissing('ideas', OPENID, ideasBag, id, {
        id: id,
        text: text,
        status: status,
        source_date: isDate(row.source_date) ? row.source_date : '',
        created: isDate(row.created) ? row.created : '',
        dropped_at: isDate(row.dropped_at) ? row.dropped_at : (status === 'dropped' && isDate(String(row.updated_at || '').slice(0, 10)) ? String(row.updated_at).slice(0, 10) : ''),
        sec_review: !!g.review,
        updated_at: new Date().toISOString(),
      });
      imported.ideas++;
    }

    const habits = asList(src.habits, 'id');
    for (let i = 0; i < habits.length; i++) {
      const row = habits[i] || {};
      const id = clip(row.id, 40);
      const name = clip(row.name, 30).trim();
      if (!id || !name) continue;
      if (habitsBag.map[id]) continue;
      const g = await guard(OPENID, [name]);
      if (!g.ok) { skipped.push({ type: 'habit', key: id }); continue; }
      await fillMissing('habits', OPENID, habitsBag, id, {
        id: id,
        name: name,
        sort: Number(row.sort) || 0,
        archived: !!row.archived,
        created: isDate(row.created) ? row.created : '',
        updated_at: new Date().toISOString(),
      });
      imported.habits++;
    }

    const logs = Array.isArray(src.habitLogs) ? src.habitLogs : (Array.isArray(src.logs) ? src.logs : []);
    for (let i = 0; i < logs.length; i++) {
      const row = logs[i];
      const habitId = Array.isArray(row) ? row[0] : (row && row.habit_id);
      const day = Array.isArray(row) ? row[1] : (row && row.date);
      if (!habitId || !isDate(day) || !habitsBag.map[habitId]) continue;
      const key = habitId + '|' + day;
      if (logsBag.map[key]) continue;
      await fillMissing('habit_logs', OPENID, logsBag, key, {
        key: key,
        habit_id: habitId,
        date: day,
        done: true,
      });
      imported.logs++;
    }

    const digestRows = asList(src.digests, 'key');
    for (let i = 0; i < digestRows.length; i++) {
      const row = digestRows[i] || {};
      const kind = row.kind;
      const key = clip(row.key, 20);
      if (['week', 'quarter', 'year'].indexOf(kind) < 0 || !key) continue;
      const id = kind + '|' + key;
      if (digestsBag.docs[id] && !isEmpty(digestsBag.docs[id].content)) continue;
      const content = cleanDigest(row);
      if (!content) continue;
      const g = await guard(OPENID, digestParts(content));
      if (!g.ok) { skipped.push({ type: 'digest', key: id }); continue; }
      const how = await fillMissing('digests', OPENID, digestsBag, id, {
        kind: kind,
        key: key,
        content: content,
        created_at: row.created_at || new Date().toISOString(),
      });
      if (how !== 'kept') imported.digests++;
    }

    const settings = src.settings && typeof src.settings === 'object' ? src.settings : {};
    const user = src.user && typeof src.user === 'object' ? src.user : {};
    const name = clip(user.name || settings.name || '', 20).trim();
    const questions = Array.isArray(settings.questions) ? settings.questions.map(s => clip(s, 120).trim()).filter(Boolean).slice(0, 10) : [];
    const theme = THEMES[settings.theme] ? settings.theme : '';
    const deliver = settings.deliver === 'now' ? 'now' : (settings.deliver === 'morning' ? 'morning' : '');
    if (name || questions.length || theme || deliver) {
      const g = await guard(OPENID, [name].concat(questions));
      if (!g.ok) skipped.push({ type: 'settings', key: 'settings' });
      else {
        const settingRows = await loadRows('settings', OPENID);
        const existing = settingRows[0];
        const data = { sec_review: !!g.review };
        if (name) data.name = name;
        if (questions.length) data.questions = questions;
        if (theme) data.theme = theme;
        if (deliver) data.deliver = deliver;
        if (!existing) {
          data.updated_at = new Date().toISOString();
          if (!data.theme) data.theme = 'auto';
          await db.collection('settings').add({ data: Object.assign({ _openid: OPENID }, data) });
          imported.settings = 1;
        } else {
          const patch = {};
          Object.keys(data).forEach(k => {
            if (k === 'sec_review') return;
            if (isEmpty(existing[k]) && !isEmpty(data[k])) patch[k] = data[k];
          });
          if (Object.keys(patch).length) {
            patch.updated_at = new Date().toISOString();
            await db.collection('settings').doc(existing._id).update({ data: patch });
            imported.settings = 1;
          }
        }
      }
    }

    return {
      ok: true,
      imported: imported,
      skipped: skipped,
      message: skipped.length
        ? '有些内容没通过检查，已跳过。已有的数据没被盖掉，缺的回信和周信会补上。'
        : '导入完成。再选一次同一个文件，只会补上还没有的回信和周信，不会盖掉已有内容。',
    };
  } catch (e) {
    console.error(e);
    return { ok: false, code: 'error', message: '导入中断了，已写入的部分还在。可以再导一次，不会盖掉已有内容。', imported: imported, skipped: skipped };
  }
};

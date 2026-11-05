// 从网页版导出的 JSON 一次性导入。丢掉回信、周信、反馈和账号密码。同一日期 / id 再导不会重复。
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

async function idMap(coll, openid, field) {
  const map = {};
  let skip = 0;
  for (let n = 0; n < 30; n++) {
    let res;
    try {
      res = await db.collection(coll).where({ _openid: openid }).skip(skip).limit(100).get();
    } catch (e) {
      return map;
    }
    const rows = res.data || [];
    rows.forEach(row => { if (row[field]) map[row[field]] = row._id; });
    if (rows.length < 100) break;
    skip += rows.length;
  }
  return map;
}

async function put(coll, openid, map, key, data) {
  if (map[key]) {
    await db.collection(coll).doc(map[key]).update({ data: data });
    return map[key];
  }
  const add = await db.collection(coll).add({ data: Object.assign({}, data, { _openid: openid }) });
  map[key] = add._id;
  return add._id;
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { ok: false, code: 'auth', message: '没有微信身份' };
  const src = unwrap(event);
  const skipped = [];
  const imported = { letters: 0, todos: 0, ideas: 0, habits: 0, logs: 0, settings: 0 };
  try {
    const letterMap = await idMap('letters', OPENID, 'date');
    const todoMap = await idMap('todos', OPENID, 'id');
    const ideaMap = await idMap('ideas', OPENID, 'id');
    const habitMap = await idMap('habits', OPENID, 'id');
    const logMap = {};
    {
      let skip = 0;
      for (let n = 0; n < 30; n++) {
        let res;
        try {
          res = await db.collection('habit_logs').where({ _openid: OPENID }).skip(skip).limit(100).get();
        } catch (e) {
          break;
        }
        const rows = (res && res.data) || [];
        rows.forEach(row => {
          const key = row.key || (row.habit_id && row.date ? row.habit_id + '|' + row.date : '');
          if (key) logMap[key] = row._id;
        });
        if (rows.length < 100) break;
        skip += rows.length;
      }
    }

    const letters = asList(src.letters, 'date');
    for (let i = 0; i < letters.length; i++) {
      const row = letters[i] || {};
      if (!isDate(row.date)) continue;
      const text = clip(row.text, 20000);
      if (!String(text).trim()) continue;
      const g = await guard(OPENID, [text]);
      if (!g.ok) { skipped.push({ type: 'letter', key: row.date }); continue; }
      const reply = row.reply && typeof row.reply === 'object' ? row.reply : {};
      const mood = MOODS[row.mood] ? row.mood : (MOODS[reply.mood] ? reply.mood : '');
      const energyRaw = row.energy != null ? row.energy : reply.energy;
      const energyNum = Number(energyRaw);
      const energy = energyNum >= 1 && energyNum <= 5 ? Math.round(energyNum) : null;
      await put('letters', OPENID, letterMap, row.date, {
        date: row.date,
        text: text,
        mood: mood,
        energy: energy,
        sent_at: row.sent_at || row.updated_at || row.replied_at || new Date().toISOString(),
        opened: true,
        sec_review: !!g.review,
        sec_unchecked: !!g.unchecked,
        updated_at: new Date().toISOString(),
      });
      imported.letters++;
    }

    const todos = asList(src.todos, 'id');
    for (let i = 0; i < todos.length; i++) {
      const row = todos[i] || {};
      const id = clip(row.id, 40);
      const text = clip(row.text, 200).trim();
      if (!id || !text) continue;
      const note = clip(row.note, 500).trim();
      const g = await guard(OPENID, [text, note]);
      if (!g.ok) { skipped.push({ type: 'todo', key: id }); continue; }
      await put('todos', OPENID, todoMap, id, {
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
      const g = await guard(OPENID, [text]);
      if (!g.ok) { skipped.push({ type: 'idea', key: id }); continue; }
      const status = ['open', 'todo', 'dropped'].indexOf(row.status) >= 0 ? row.status : 'open';
      await put('ideas', OPENID, ideaMap, id, {
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
      const g = await guard(OPENID, [name]);
      if (!g.ok) { skipped.push({ type: 'habit', key: id }); continue; }
      await put('habits', OPENID, habitMap, id, {
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
      if (!habitId || !isDate(day) || !habitMap[habitId]) continue;
      const key = habitId + '|' + day;
      await put('habit_logs', OPENID, logMap, key, {
        key: key,
        habit_id: habitId,
        date: day,
        done: true,
      });
      imported.logs++;
    }

    const settings = src.settings && typeof src.settings === 'object' ? src.settings : {};
    const user = src.user && typeof src.user === 'object' ? src.user : {};
    const name = clip(user.name || settings.name || '', 20).trim();
    const questions = Array.isArray(settings.questions) ? settings.questions.map(s => clip(s, 120).trim()).filter(Boolean).slice(0, 10) : [];
    if (name || questions.length || settings.theme) {
      const g = await guard(OPENID, [name].concat(questions));
      if (!g.ok) skipped.push({ type: 'settings', key: 'settings' });
      else {
        const settingMap = await idMap('settings', OPENID, '_id');
        const existing = Object.keys(settingMap)[0];
        const data = {
          theme: THEMES[settings.theme] ? settings.theme : 'auto',
          name: name,
          questions: questions,
          sec_review: !!g.review,
          updated_at: new Date().toISOString(),
        };
        if (existing) await db.collection('settings').doc(existing).update({ data: data });
        else await db.collection('settings').add({ data: Object.assign({ _openid: OPENID }, data) });
        imported.settings = 1;
      }
    }

    return {
      ok: true,
      imported: imported,
      skipped: skipped,
      message: skipped.length ? '有些内容没通过检查，已跳过，其余已导入' : '导入完成',
    };
  } catch (e) {
    console.error(e);
    return { ok: false, code: 'error', message: '导入中断了，已写入的部分还在。可以再导一次，不会重复。', imported: imported, skipped: skipped };
  }
};

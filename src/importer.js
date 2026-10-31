// 回信 · 导入 Life OS 的备份文件（设置 → 导出备份 得到的 JSON）
// 只补不盖：回信里已经有的同一天 / 同一件事，保留回信里的版本
import { nowIso, parseJSON, isDate, cstDate } from './util.js';

function val(v) {
  return typeof v === 'string' ? parseJSON(v, v) : v;
}

export async function importBackup(env, U, raw) {
  // 兼容 { lifeos_xxx: "..."} 和不带前缀的写法
  const data = {};
  Object.keys(raw || {}).forEach(k => {
    const key = k.startsWith('lifeos_') ? k.slice(7) : k;
    data[key] = val(raw[k]);
  });

  const now = nowIso();
  const stmts = [];
  const n = { letters: 0, todos: 0, habits: 0, habitLogs: 0, weekly: 0, ideas: 0 };
  let questions = null;

  const settings = data.settings || {};
  if (Array.isArray(settings.dailyQuestions) && settings.dailyQuestions.length) questions = settings.dailyQuestions;

  // 日记 → 信
  for (const k of Object.keys(data)) {
    if (!k.startsWith('journal_')) continue;
    const date = k.slice(8);
    const j = data[k];
    if (!isDate(date) || !j || typeof j !== 'object') continue;
    const free = String(j.journal || '').trim();
    const answers = Array.isArray(j.answers) ? j.answers.map(a => String(a || '').trim()) : [];
    let text = free;
    if (!text && answers.some(Boolean)) {
      const qs = questions || [];
      text = answers.map((a, i) => (a ? (qs[i] ? qs[i] + '\n' : '') + a : '')).filter(Boolean).join('\n\n');
    }
    if (!text) continue;
    const reply = answers.some(Boolean) ? JSON.stringify({ imported: true, answers, questions: questions || [] }) : null;
    stmts.push(env.DB.prepare('INSERT OR IGNORE INTO letters (user_id, date, text, reply, updated_at) VALUES (?, ?, ?, ?, ?)')
      .bind(U, date, text, reply, j.savedAt || now));
    n.letters++;
  }

  // 待办
  for (const t of Array.isArray(data.tasks) ? data.tasks : []) {
    if (!t || !t.text) continue;
    stmts.push(env.DB.prepare(`INSERT OR IGNORE INTO todos (id, user_id, text, due, done, done_at, archived, source_date, created, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`)
      .bind('old-' + t.id, U, String(t.text).slice(0, 200), isDate(t.due) ? t.due : null, t.done ? 1 : 0,
        t.done ? (isDate(t.doneAt) ? t.doneAt : null) : null, t.archived ? 1 : 0, isDate(t.created) ? t.created : cstDate(), now));
    n.todos++;
  }

  // 习惯 + 打卡记录
  (Array.isArray(data.habits) ? data.habits : []).forEach((h, i) => {
    if (!h || !h.name) return;
    const id = 'old-' + h.id;
    stmts.push(env.DB.prepare('INSERT OR IGNORE INTO habits (id, user_id, name, sort, archived, created) VALUES (?, ?, ?, ?, 0, ?)')
      .bind(id, U, String(h.name).slice(0, 30), i, isDate(h.created) ? h.created : cstDate()));
    n.habits++;
    for (const d of Array.isArray(h.log) ? h.log : []) {
      if (!isDate(d)) continue;
      stmts.push(env.DB.prepare('INSERT OR IGNORE INTO habit_logs (user_id, habit_id, date) VALUES (?, ?, ?)').bind(U, id, d));
      n.habitLogs++;
    }
  });

  // 周复盘 → 周信
  for (const k of Object.keys(data)) {
    if (!k.startsWith('weekly_')) continue;
    const key = k.slice(7);
    const w = data[k];
    if (!isDate(key) || !w || typeof w !== 'object') continue;
    const parts = [];
    if (w.summary) parts.push(String(w.summary));
    if (w.good) parts.push('做得好的：' + w.good);
    if (w.bad) parts.push('需要改进的：' + w.bad);
    if (w.flow) parts.push('忘了时间的事：' + w.flow);
    if (!parts.length && !w.next) continue;
    const content = { title: '旧版周复盘', letter: parts.join('\n\n'), next: w.next || '', imported: true };
    stmts.push(env.DB.prepare('INSERT OR IGNORE INTO digests (user_id, kind, key, content, created_at) VALUES (?, \'week\', ?, ?, ?)')
      .bind(U, key, JSON.stringify(content), now));
    n.weekly++;
  }

  // 写作看板「草稿」里的选题 → 点子
  const writing = data.writing;
  const boards = writing && Array.isArray(writing.boards) ? writing.boards : [];
  for (const b of boards) {
    const drafts = (b && b.columns && Array.isArray(b.columns.drafts)) ? b.columns.drafts : [];
    for (const c of drafts) {
      const text = String((c && (c.title || c.note)) || '').trim();
      if (!text) continue;
      stmts.push(env.DB.prepare('INSERT OR IGNORE INTO ideas (id, user_id, text, status, source_date, created, updated_at) VALUES (?, ?, ?, \'open\', NULL, ?, ?)')
        .bind('old-' + (c.id || text.slice(0, 20)), U, text.slice(0, 300), isDate(c.created) ? c.created : cstDate(), now));
      n.ideas++;
    }
  }

  if (questions) {
    const row = await env.DB.prepare('SELECT json FROM settings WHERE user_id = ?').bind(U).first();
    const s = row ? parseJSON(row.json, {}) : {};
    if (!s.questions) {
      s.questions = questions.map(q => String(q).slice(0, 120)).slice(0, 10);
      stmts.push(env.DB.prepare('INSERT INTO settings (user_id, json) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET json = excluded.json')
        .bind(U, JSON.stringify(s)));
    }
  }
  if (settings.userName) {
    stmts.push(env.DB.prepare("UPDATE users SET name = ? WHERE id = ? AND name = ''").bind(String(settings.userName).slice(0, 20), U));
  }

  for (let i = 0; i < stmts.length; i += 80) await env.DB.batch(stmts.slice(i, i + 80));
  return { ok: true, imported: n };
}

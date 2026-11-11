// 回信 · Cloudflare Worker
// 静态页面由 Workers Assets 直接提供；/api/* 走这里
import { login, logout, register, currentUser } from './auth.js';
import { writeReply, writeDigest, DEFAULT_QUESTIONS, PROVIDERS, testAI } from './ai.js';
import { encryptKey, decryptKey } from './secret.js';
import { importBackup } from './importer.js';
import {
  json, err, cstDate, addDays, weekKey, quarterKey, periodRange, uid, nowIso, norm, parseJSON, isDate,
} from './util.js';

// 示例账号：别人登录演示时不能改 AI 设置（Key 是站点的）
const DEMO_USERS = ['huixin-demo'];

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    try {
      return await api(req, env, ctx, url);
    } catch (e) {
      console.error(e);
      return err(e.message || '服务器出错了', 500);
    }
  },

  // 每天北京时间 6:00：周一送周信，季初送季信，元旦送年信
  async scheduled(event, env, ctx) {
    ctx.waitUntil(deliverDue(env, cstDate()));
  },
};

async function api(req, env, ctx, url) {
  const p = url.pathname.slice(4);   // 去掉 /api
  const m = req.method;

  if (p === '/login' && m === 'POST') return login(req, env);
  if (p === '/register' && m === 'POST') return register(req, env);
  if (p === '/logout' && m === 'POST') return logout(req, env);

  const user = await currentUser(req, env);
  if (!user) return err('请先登录', 401);
  const U = user.id;
  const body = (m === 'POST' || m === 'PUT' || m === 'PATCH') ? await req.json().catch(() => ({})) : {};
  const seg = p.split('/').filter(Boolean);   // e.g. ['letters','2026-10-31','reply']

  // ── 启动：一次拿齐首屏需要的所有数据 ──
  if (p === '/bootstrap' && m === 'GET') return json(await bootstrap(env, user));

  // ── 设置 ──
  if (p === '/settings' && m === 'PUT') {
    const cur = await getSettings(env, U);
    const next = { ...cur, ...pick(body, ['theme', 'questions', 'deliver']) };
    if (next.deliver !== 'now') next.deliver = 'morning';   // 回信什么时候送到：明早 6 点，或寄出后马上
    if (Array.isArray(next.questions)) next.questions = next.questions.map(s => String(s).slice(0, 120)).filter(Boolean).slice(0, 10);
    await env.DB.prepare('INSERT INTO settings (user_id, json) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET json = excluded.json')
      .bind(U, JSON.stringify(next)).run();
    if (typeof body.name === 'string') await env.DB.prepare('UPDATE users SET name = ? WHERE id = ?').bind(body.name.slice(0, 20), U).run();
    return json({ ok: true, settings: next });
  }

  // ── 信 ──
  if (seg[0] === 'letters') {
    if (seg.length === 1 && m === 'GET') {
      const before = isDate(url.searchParams.get('before')) ? url.searchParams.get('before') : '9999-12-31';
      const rows = await env.DB.prepare('SELECT * FROM letters WHERE user_id = ? AND date < ? ORDER BY date DESC LIMIT 60')
        .bind(U, before).all();
      return json({ letters: rows.results.map(letterOut) });
    }
    const date = seg[1];
    if (!isDate(date)) return err('日期不对');
    if (seg.length === 2 && m === 'PUT') {
      const text = String(body.text || '').slice(0, 20000);
      await env.DB.prepare(`INSERT INTO letters (user_id, date, text, updated_at) VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id, date) DO UPDATE SET text = excluded.text, updated_at = excluded.updated_at`)
        .bind(U, date, text, nowIso()).run();
      return json({ ok: true });
    }
    if (seg.length === 2 && m === 'DELETE') {
      await env.DB.prepare('DELETE FROM letters WHERE user_id = ? AND date = ?').bind(U, date).run();
      return json({ ok: true });
    }
    if (seg[2] === 'reply' && m === 'POST') return json(await replyTo(env, user, date, body.today));
  }

  // ── 待办（id 由前端生成，PUT 即「有则改、无则建」，离线重发也不会重复） ──
  if (seg[0] === 'todos' && seg[1]) {
    const id = seg[1];
    if (m === 'PUT') {
      const now = nowIso();
      const t = pick(body, ['text', 'due', 'done', 'archived', 'note', 'dropped']);
      const note = 'note' in t ? String(t.note || '').trim().slice(0, 500) : null;
      const ex = await env.DB.prepare('SELECT * FROM todos WHERE id = ? AND user_id = ?').bind(id, U).first();
      if (!ex) {
        if (!t.text) return err('待办内容不能为空');
        await env.DB.prepare(`INSERT INTO todos (id, user_id, text, due, done, done_at, archived, source_date, created, updated_at, note, dropped_at)
          VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`)
          .bind(id, U, String(t.text).slice(0, 200), t.due || null, t.done ? 1 : 0, t.done ? cstDate() : null,
            body.source_date || null, body.created || cstDate(), now, note || '', t.dropped ? (body.dropped_at || cstDate()) : null).run();
      } else {
        const done = 'done' in t ? (t.done ? 1 : 0) : ex.done;
        const doneAt = done ? (ex.done ? ex.done_at : (body.done_at || cstDate())) : null;
        // 放下：dropped=true 记下日期，dropped=false 恢复成待办；完成和放下互斥
        const droppedAt = 'dropped' in t ? (t.dropped ? (ex.dropped_at || body.dropped_at || cstDate()) : null) : ex.dropped_at;
        await env.DB.prepare('UPDATE todos SET text = ?, due = ?, done = ?, done_at = ?, archived = ?, note = ?, dropped_at = ?, updated_at = ? WHERE id = ? AND user_id = ?')
          .bind('text' in t ? String(t.text).slice(0, 200) : ex.text, 'due' in t ? (t.due || null) : ex.due,
            droppedAt ? 0 : done, droppedAt ? null : doneAt, 'archived' in t ? (t.archived ? 1 : 0) : ex.archived,
            note != null ? note : (ex.note || ''), droppedAt, now, id, U).run();
      }
      return json({ ok: true, todo: todoOut(await env.DB.prepare('SELECT * FROM todos WHERE id = ?').bind(id).first()) });
    }
    if (m === 'DELETE') {
      await env.DB.prepare('DELETE FROM todos WHERE id = ? AND user_id = ?').bind(id, U).run();
      return json({ ok: true });
    }
  }
  if (p === '/todos' && m === 'GET') {
    const rows = await env.DB.prepare('SELECT * FROM todos WHERE user_id = ? ORDER BY done, COALESCE(due, \'9999\'), created DESC').bind(U).all();
    return json({ todos: rows.results.map(todoOut) });
  }

  // ── 点子 ──
  // 放下的点子：平时不加载，点子列表底部点开时才取
  if (p === '/ideas/dropped' && m === 'GET') {
    const rows = await env.DB.prepare("SELECT * FROM ideas WHERE user_id = ? AND status = 'dropped' ORDER BY updated_at DESC LIMIT 200").bind(U).all();
    return json({ ideas: rows.results.map(r => ({ ...ideaOut(r), dropped_at: (r.updated_at || '').slice(0, 10) })) });
  }
  if (seg[0] === 'ideas' && seg[1] && m === 'PUT') {
    const id = seg[1];
    const ex = await env.DB.prepare('SELECT * FROM ideas WHERE id = ? AND user_id = ?').bind(id, U).first();
    const now = nowIso();
    if (!ex) {
      if (!body.text) return err('点子内容不能为空');
      await env.DB.prepare('INSERT INTO ideas (id, user_id, text, status, source_date, created, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(id, U, String(body.text).slice(0, 300), body.status || 'open', body.source_date || null, body.created || cstDate(), now).run();
    } else {
      await env.DB.prepare('UPDATE ideas SET text = ?, status = ?, updated_at = ? WHERE id = ? AND user_id = ?')
        .bind(body.text ? String(body.text).slice(0, 300) : ex.text, body.status || ex.status, now, id, U).run();
    }
    return json({ ok: true });
  }
  if (seg[0] === 'ideas' && seg[1] && m === 'DELETE') {
    await env.DB.prepare('DELETE FROM ideas WHERE id = ? AND user_id = ?').bind(seg[1], U).run();
    return json({ ok: true });
  }

  // ── 习惯 ──
  if (seg[0] === 'habits' && seg[1]) {
    const id = seg[1];
    if (seg[2] === 'log' && isDate(seg[3]) && m === 'PUT') {
      const h = await env.DB.prepare('SELECT id FROM habits WHERE id = ? AND user_id = ?').bind(id, U).first();
      if (!h) return err('没有这个习惯', 404);
      if (body.done) {
        await env.DB.prepare('INSERT OR IGNORE INTO habit_logs (user_id, habit_id, date) VALUES (?, ?, ?)').bind(U, id, seg[3]).run();
      } else {
        await env.DB.prepare('DELETE FROM habit_logs WHERE habit_id = ? AND date = ? AND user_id = ?').bind(id, seg[3], U).run();
      }
      return json({ ok: true });
    }
    if (m === 'PUT') {
      const ex = await env.DB.prepare('SELECT * FROM habits WHERE id = ? AND user_id = ?').bind(id, U).first();
      if (!ex) {
        if (!body.name) return err('习惯名不能为空');
        await env.DB.prepare('INSERT INTO habits (id, user_id, name, sort, archived, created) VALUES (?, ?, ?, ?, 0, ?)')
          .bind(id, U, String(body.name).slice(0, 30), Number(body.sort) || 0, cstDate()).run();
      } else {
        await env.DB.prepare('UPDATE habits SET name = ?, sort = ?, archived = ? WHERE id = ? AND user_id = ?')
          .bind(body.name ? String(body.name).slice(0, 30) : ex.name, 'sort' in body ? Number(body.sort) || 0 : ex.sort,
            'archived' in body ? (body.archived ? 1 : 0) : ex.archived, id, U).run();
      }
      return json({ ok: true });
    }
  }

  // ── 周信 / 季信 / 年信：手动生成（定时任务之外，随时可以让它现在写） ──
  if (p === '/digests' && m === 'POST') {
    const kind = body.kind;
    if (!['week', 'quarter', 'year'].includes(kind)) return err('类型不对');
    const key = String(body.key || '');
    const d = await makeDigest(env, user, kind, key);
    if (!d) return err('这段时间还没有信，写不出' + ({ week: '周信', quarter: '季信', year: '年信' }[kind]));
    return json({ digest: d });
  }

  // ── 「有用 / 没用」 ──
  if (p === '/feedback' && m === 'POST') {
    if (!isDate(body.date) || !body.block) return err('参数不对');
    const v = Number(body.value);
    if (v === 0) {
      await env.DB.prepare('DELETE FROM feedback WHERE user_id = ? AND date = ? AND block = ?').bind(U, body.date, String(body.block).slice(0, 30)).run();
    } else {
      await env.DB.prepare(`INSERT INTO feedback (user_id, date, block, value) VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id, date, block) DO UPDATE SET value = excluded.value`).bind(U, body.date, String(body.block).slice(0, 30), v > 0 ? 1 : -1).run();
    }
    return json({ ok: true });
  }

  // ── 自己的 AI（OpenAI 兼容接口） ──
  if (p === '/ai-config' && m === 'GET') return json(await aiConfigOut(env, U));
  if (p.startsWith('/ai-config') && m !== 'GET' && DEMO_USERS.includes(user.username)) return err('示例账号不能修改 AI 设置');
  if (p === '/ai-config' && m === 'PUT') {
    const cfg = await aiConfigIn(env, U, body);
    if (cfg.error) return err(cfg.error);
    const keyEnc = cfg.keyChanged ? await encryptKey(env, cfg.key) : cfg.keyEnc;
    await env.DB.prepare(`INSERT INTO ai_config (user_id, provider, base_url, model, key_enc, key_last4, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET provider = excluded.provider, base_url = excluded.base_url, model = excluded.model,
      key_enc = excluded.key_enc, key_last4 = excluded.key_last4, updated_at = excluded.updated_at`)
      .bind(U, cfg.provider, cfg.baseUrl, cfg.model, keyEnc, cfg.key.slice(-4), nowIso()).run();
    return json(await aiConfigOut(env, U));
  }
  if (p === '/ai-config' && m === 'DELETE') {
    await env.DB.prepare('DELETE FROM ai_config WHERE user_id = ?').bind(U).run();
    return json(await aiConfigOut(env, U));
  }
  if (p === '/ai-config/test' && m === 'POST') {
    const cfg = await aiConfigIn(env, U, body);
    if (cfg.error) return err(cfg.error);
    try { return json({ ok: true, ...(await testAI(cfg)) }); }
    catch (e) { return json({ ok: false, error: e.message }); }
  }

  // ── 导入 Life OS 旧数据 ──
  if (p === '/import' && m === 'POST') return json(await importBackup(env, U, body));

  return err('没有这个接口', 404);
}

// ───────────── 首屏数据 ─────────────

async function getSettings(env, U) {
  const row = await env.DB.prepare('SELECT json FROM settings WHERE user_id = ?').bind(U).first();
  const s = row ? parseJSON(row.json, {}) : {};
  if (!Array.isArray(s.questions) || !s.questions.length) s.questions = DEFAULT_QUESTIONS;
  if (!s.theme) s.theme = 'auto';
  return s;
}

async function bootstrap(env, user) {
  const U = user.id;
  const today = cstDate();
  const since = addDays(today, -120);
  const [settings, letters, todos, ideas, habits, logs, digests, fb, count] = await Promise.all([
    getSettings(env, U),
    env.DB.prepare('SELECT * FROM letters WHERE user_id = ? AND date >= ? ORDER BY date DESC').bind(U, since).all(),
    env.DB.prepare(`SELECT * FROM todos WHERE user_id = ? AND archived = 0
      AND ((done = 0 AND dropped_at IS NULL) OR done_at >= ? OR dropped_at >= ?)`).bind(U, addDays(today, -30), addDays(today, -30)).all(),
    env.DB.prepare("SELECT * FROM ideas WHERE user_id = ? AND status != 'dropped' ORDER BY created DESC").bind(U).all(),
    env.DB.prepare('SELECT * FROM habits WHERE user_id = ? AND archived = 0 ORDER BY sort, created').bind(U).all(),
    env.DB.prepare('SELECT habit_id, date FROM habit_logs WHERE user_id = ? AND date >= ?').bind(U, addDays(today, -70)).all(),
    env.DB.prepare('SELECT * FROM digests WHERE user_id = ? ORDER BY key DESC').bind(U).all(),
    env.DB.prepare('SELECT date, block, value FROM feedback WHERE user_id = ? AND date >= ?').bind(U, since).all(),
    env.DB.prepare("SELECT COUNT(*) AS n, MIN(date) AS first FROM letters WHERE user_id = ? AND text != ''").bind(U).first(),
  ]);
  return {
    user, today, settings,
    letters: letters.results.map(letterOut),
    todos: todos.results.map(todoOut),
    ideas: ideas.results.map(ideaOut),
    habits: habits.results.map(h => ({ id: h.id, name: h.name, sort: h.sort })),
    habitLogs: logs.results.map(l => [l.habit_id, l.date]),
    digests: digests.results.map(d => ({ kind: d.kind, key: d.key, created_at: d.created_at, ...parseJSON(d.content, {}) })),
    feedback: fb.results,
    stats: { letters: count ? count.n : 0, first: count ? count.first : null },
  };
}

function letterOut(r) {
  return { date: r.date, text: r.text, reply: parseJSON(r.reply), energy: r.energy, mood: r.mood, replied_at: r.replied_at, updated_at: r.updated_at };
}
function todoOut(r) {
  return { id: r.id, text: r.text, due: r.due, done: !!r.done, done_at: r.done_at, archived: !!r.archived, source_date: r.source_date, created: r.created,
    note: r.note || '', dropped_at: r.dropped_at || null };
}
// 回信用：一条带备注的待办写成一行
function todoNoteLine(t) {
  const st = t.dropped_at ? '放下了' : t.done ? '已完成' : '还在做';
  return `${t.text}【${st}】${t.note ? '：' + String(t.note).slice(0, 120) : ''}`;
}
function ideaOut(r) {
  return { id: r.id, text: r.text, status: r.status, source_date: r.source_date, created: r.created };
}
function pick(o, keys) {
  const out = {};
  keys.forEach(k => { if (o && k in o) out[k] = o[k]; });
  return out;
}

// ───────────── 自己的 AI ─────────────

// 读出来给网页看：永远不返回 Key，只给后 4 位
async function aiConfigOut(env, U) {
  const row = await env.DB.prepare('SELECT provider, base_url, model, key_last4, updated_at FROM ai_config WHERE user_id = ?').bind(U).first();
  const providers = Object.fromEntries(Object.entries(PROVIDERS).map(([k, v]) => [k, v]));
  if (!row) return { configured: false, providers };
  return { configured: true, provider: row.provider, base_url: row.base_url, model: row.model, last4: row.key_last4, updated_at: row.updated_at, providers };
}

// 校验网页提交的配置；Key 留空表示沿用已保存的
async function aiConfigIn(env, U, body) {
  const provider = PROVIDERS[body.provider] ? body.provider : 'custom';
  const baseUrl = String(body.base_url || (PROVIDERS[provider] || {}).base || '').trim();
  const model = String(body.model || '').trim();
  let key = String(body.key || '').trim();
  let keyEnc = null, keyChanged = !!key;
  if (!/^https:\/\/[^\s]+$/i.test(baseUrl) && !(env.ALLOW_HTTP_AI && /^http:\/\/(localhost|127\.0\.0\.1)/.test(baseUrl))) {
    return { error: '接口地址要以 https:// 开头' };
  }
  if (!model) return { error: '请填写模型名' };
  if (!key) {
    const row = await env.DB.prepare('SELECT key_enc FROM ai_config WHERE user_id = ?').bind(U).first();
    if (!row) return { error: '请填写 API Key' };
    keyEnc = row.key_enc;
    key = await decryptKey(env, keyEnc);
  }
  if (key.length < 8) return { error: 'API Key 看起来不完整' };
  return { provider, baseUrl, model: model.slice(0, 120), key, keyEnc, keyChanged };
}

// 回信和周信用：给这次请求带上用户自己的 AI（没配就是 null）
async function withUserAI(env, U) {
  const row = await env.DB.prepare('SELECT * FROM ai_config WHERE user_id = ?').bind(U).first();
  let userAI = null;
  if (row) {
    try {
      userAI = { baseUrl: row.base_url, model: row.model, key: await decryptKey(env, row.key_enc),
        label: (PROVIDERS[row.provider] || PROVIDERS.custom).name + (row.provider === 'custom' ? ' AI' : '') };
    } catch (e) { console.error('解密用户 Key 失败', U, e.message); }
  }
  return { ...env, userAI };
}

// ───────────── 写回信 ─────────────

async function replyTo(env, user, date, clientToday) {
  const U = user.id;
  const letter = await env.DB.prepare('SELECT * FROM letters WHERE user_id = ? AND date = ?').bind(U, date).first();
  if (!letter || !letter.text.trim()) throw new Error('信还是空的');
  const today = isDate(clientToday) ? clientToday : cstDate();
  const [settings, openTodos, ideas, yday, noted] = await Promise.all([
    getSettings(env, U),
    env.DB.prepare('SELECT id, text, due, source_date, created FROM todos WHERE user_id = ? AND done = 0 AND archived = 0 AND dropped_at IS NULL').bind(U).all(),
    env.DB.prepare("SELECT id, text, source_date, created FROM ideas WHERE user_id = ? AND status = 'open' ORDER BY created DESC LIMIT 40").bind(U).all(),
    env.DB.prepare('SELECT reply FROM letters WHERE user_id = ? AND date = ?').bind(U, addDays(date, -1)).first(),
    // 最近一周写过备注、或放下的待办：让回信知道他自己是怎么说的
    env.DB.prepare(`SELECT text, done, dropped_at, note FROM todos WHERE user_id = ? AND archived = 0
      AND (dropped_at >= ? OR (note != '' AND updated_at >= ?)) ORDER BY updated_at DESC LIMIT 15`)
      .bind(U, addDays(date, -7), addDays(date, -7)).all(),
  ]);

  const aiEnv = await withUserAI(env, U);
  const r = await writeReply(aiEnv, {
    name: user.name, date, today, backfill: date !== today, text: letter.text,
    questions: settings.questions,
    openTodos: openTodos.results.map(t => t.text),
    notes: noted.results.map(todoNoteLine),
    ideas: ideas.results.map(t => t.text),
    yesterday: yday && parseJSON(yday.reply, {}) ? (parseJSON(yday.reply, {}).summary || '') : '',
  });

  // 拆出来的待办 / 点子入库（按文字去重）
  const now = nowIso();
  // 最近放下的事也算「已经有了」，免得回信又把它加回待办
  const haveT = new Set([...openTodos.results, ...noted.results.filter(t => t.dropped_at)].map(t => norm(t.text)));
  const haveI = new Set(ideas.results.map(t => norm(t.text)));
  const stmts = [];
  // 同一封信重新要回信时（比如上一次网络断了但其实写成了），之前从这封信拆出的事仍算在这封回信里
  const madeTodos = openTodos.results.filter(t => t.source_date === date)
    .map(t => ({ id: t.id, text: t.text, due: t.due, done: false, source_date: date, created: t.created }));
  const madeIdeas = ideas.results.filter(t => t.source_date === date)
    .map(t => ({ id: t.id, text: t.text, status: 'open', source_date: date, created: t.created }));
  for (const t of r.tasks) {
    const k = norm(t.text);
    if (!k || haveT.has(k)) continue;
    haveT.add(k);
    const id = uid('t');
    const due = addDays(date, t.dueDays);
    madeTodos.push({ id, text: t.text, due, done: false, source_date: date, created: date });
    stmts.push(env.DB.prepare(`INSERT INTO todos (id, user_id, text, due, done, archived, source_date, created, updated_at)
      VALUES (?, ?, ?, ?, 0, 0, ?, ?, ?)`).bind(id, U, t.text, due, date, date, now));
  }
  for (const t of r.ideas) {
    const k = norm(t.text);
    if (!k || haveI.has(k)) continue;
    haveI.add(k);
    const id = uid('i');
    madeIdeas.push({ id, text: t.text, status: 'open', source_date: date, created: date });
    stmts.push(env.DB.prepare('INSERT INTO ideas (id, user_id, text, status, source_date, created, updated_at) VALUES (?, ?, ?, \'open\', ?, ?, ?)')
      .bind(id, U, t.text, date, date, now));
  }

  const reply = {
    summary: r.summary, energy: r.energy, mood: r.mood, highlight: r.highlight,
    questions: settings.questions, lenses: r.lenses,
    todos: madeTodos.map(t => ({ id: t.id, text: t.text })),
    ideas: madeIdeas.map(t => ({ id: t.id, text: t.text })),
    engine: aiEnv.__engine || '',
    ownError: aiEnv.__ownError || undefined,   // 自己的 AI 出错、改用了免费模型时，告诉用户原因
  };
  stmts.push(env.DB.prepare('UPDATE letters SET reply = ?, energy = ?, mood = ?, replied_at = ? WHERE user_id = ? AND date = ?')
    .bind(JSON.stringify(reply), r.energy, r.mood, now, U, date));
  await env.DB.batch(stmts);
  return { reply, replied_at: now, todos: madeTodos, ideas: madeIdeas };
}

// ───────────── 周信 / 季信 / 年信 ─────────────

async function makeDigest(env, user, kind, key) {
  const U = user.id;
  if (kind === 'week' && !isDate(key)) key = weekKey(cstDate());
  if (kind === 'quarter' && !/^\d{4}-Q[1-4]$/.test(key)) key = quarterKey(cstDate());
  if (kind === 'year' && !/^\d{4}$/.test(key)) key = cstDate().slice(0, 4);
  if (kind === 'week') key = weekKey(key);
  const [start, end] = periodRange(kind, key);

  const letters = (await env.DB.prepare("SELECT date, text, reply, energy, mood FROM letters WHERE user_id = ? AND date BETWEEN ? AND ? AND text != '' ORDER BY date")
    .bind(U, start, end).all()).results;
  if (!letters.length) return null;

  const per = kind === 'week' ? 900 : kind === 'quarter' ? 220 : 90;
  const lines = [`【时间】${start} 至 ${end}`, `【他的名字】${user.name || '（未设置）'}`, '【每天的信】'];
  for (const l of letters) {
    const rp = parseJSON(l.reply, {}) || {};
    const body = kind === 'week' ? l.text : (rp.summary || l.text);
    lines.push(`${l.date}${l.energy ? ` · 精力 ${l.energy}/5` : ''}${l.mood ? ` · ${l.mood}` : ''}\n${String(body).slice(0, per)}`);
  }
  const done = (await env.DB.prepare('SELECT text, note FROM todos WHERE user_id = ? AND done = 1 AND done_at BETWEEN ? AND ?').bind(U, start, end).all()).results;
  lines.push(`【完成的待办】${done.length ? '\n' + done.map(t => '- ' + t.text + (t.note ? `（他的备注：${t.note.slice(0, 120)}）` : '')).join('\n') : '（无）'}`);
  const dropped = (await env.DB.prepare('SELECT text, note FROM todos WHERE user_id = ? AND dropped_at BETWEEN ? AND ?').bind(U, start, end).all()).results;
  if (dropped.length) lines.push('【放下的待办（决定不做或做不了）】\n' + dropped.map(t => '- ' + t.text + (t.note ? `（原因 / 备注：${t.note.slice(0, 120)}）` : '')).join('\n'));
  const pending = (await env.DB.prepare(`SELECT text, note FROM todos WHERE user_id = ? AND done = 0 AND dropped_at IS NULL AND note != ''
    AND substr(updated_at, 1, 10) BETWEEN ? AND ?`).bind(U, start, end).all()).results;
  if (pending.length) lines.push('【还在做的待办和他写的备注】\n' + pending.map(t => `- ${t.text}：${t.note.slice(0, 120)}`).join('\n'));
  const habits = (await env.DB.prepare(`SELECT h.name, COUNT(l.date) AS n FROM habits h LEFT JOIN habit_logs l ON l.habit_id = h.id AND l.date BETWEEN ? AND ?
    WHERE h.user_id = ? AND h.archived = 0 GROUP BY h.id`).bind(start, end, U).all()).results;
  const days = Math.round((new Date(end) - new Date(start)) / 86400e3) + 1;
  if (habits.length) lines.push('【习惯打卡】\n' + habits.map(h => `- ${h.name}：${h.n} / ${days} 天`).join('\n'));
  if (kind === 'week') {
    const stale = (await env.DB.prepare("SELECT text, created FROM ideas WHERE user_id = ? AND status = 'open' AND created <= ? ORDER BY created LIMIT 8").bind(U, end).all()).results;
    if (stale.length) lines.push('【点子库里还没动的】\n' + stale.map(i => `- ${i.text}（${i.created} 记下）`).join('\n'));
  }
  if (kind === 'year') {
    const qs = (await env.DB.prepare("SELECT key, content FROM digests WHERE user_id = ? AND kind = 'quarter' AND key LIKE ?").bind(U, key + '-%').all()).results;
    if (qs.length) lines.push('【这一年的季信】\n' + qs.map(q => `${q.key}：${(parseJSON(q.content, {}) || {}).letter || ''}`).join('\n'));
  }

  const aiEnv = await withUserAI(env, U);
  const content = await writeDigest(aiEnv, kind, lines.join('\n\n'));
  content.engine = aiEnv.__engine || '';
  const avg = letters.filter(l => l.energy).reduce((s, l, _, a) => s + l.energy / a.length, 0);
  content.stats = { letters: letters.length, days, energyAvg: avg ? Math.round(avg * 10) / 10 : null, todosDone: done.length };
  content.range = [start, end];
  const now = nowIso();
  await env.DB.prepare(`INSERT INTO digests (user_id, kind, key, content, created_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id, kind, key) DO UPDATE SET content = excluded.content, created_at = excluded.created_at`)
    .bind(U, kind, key, JSON.stringify(content), now).run();
  return { kind, key, created_at: now, ...content };
}

async function deliverDue(env, today) {
  const jobs = [];
  const dow = new Date(today + 'T00:00:00Z').getUTCDay();
  if (dow === 1) jobs.push(['week', addDays(today, -7)]);
  if (today.slice(8) === '01' && ['01', '04', '07', '10'].includes(today.slice(5, 7))) jobs.push(['quarter', quarterKey(addDays(today, -1))]);
  if (today.slice(5) === '01-01') jobs.push(['year', addDays(today, -1).slice(0, 4)]);
  if (!jobs.length) return;
  const users = (await env.DB.prepare('SELECT id, username, name FROM users').all()).results;
  for (const u of users) {
    for (const [kind, key] of jobs) {
      try { await makeDigest(env, u, kind, key); } catch (e) { console.error('digest failed', u.id, kind, key, e.message); }
    }
  }
}
export { makeDigest };

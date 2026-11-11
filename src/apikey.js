// 回信 · 只读 API 密钥
// 用户在设置里自己生成，给自己信任的 agent 或工具读取自己的数据。
// 库里只存密钥的 SHA-256；完整密钥只在生成那一刻给网页看一次。
// 接口只能读：GET /api/v1/export，请求头 Authorization: Bearer <密钥>
import { json, err, nowIso, parseJSON, isDate } from './util.js';

const RATE_PER_MIN = 30;   // 每把密钥每分钟最多 30 次
const TYPES = ['letters', 'todos', 'ideas', 'habits', 'digests'];

const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
async function sha256(s) {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
}
function b64url(bytes) {
  let s = '';
  bytes.forEach(b => { s += String.fromCharCode(b); });
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// 新表：只新增，不动已有的表
let ready = false;
async function ensureTable(env) {
  if (ready) return;
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS api_keys (
    user_id      TEXT PRIMARY KEY,
    key_hash     TEXT NOT NULL UNIQUE,
    hint         TEXT NOT NULL,
    created_at   TEXT NOT NULL,
    last_used_at TEXT,
    rl_min       TEXT,
    rl_n         INTEGER NOT NULL DEFAULT 0
  )`).run();
  ready = true;
}

function keyOut(row) {
  if (!row) return { exists: false };
  return { exists: true, hint: row.hint, created_at: row.created_at, last_used_at: row.last_used_at || null };
}

// ── 设置页用（已登录） ──
export async function apiKeyStatus(env, U) {
  await ensureTable(env);
  return keyOut(await env.DB.prepare('SELECT hint, created_at, last_used_at FROM api_keys WHERE user_id = ?').bind(U).first());
}

// 生成 = 作废旧的 + 新建一把。返回的 key 只出现这一次
export async function apiKeyCreate(env, U) {
  await ensureTable(env);
  const raw = new Uint8Array(32);
  crypto.getRandomValues(raw);
  const key = 'hx_' + b64url(raw);
  const row = { hint: key.slice(0, 7), created_at: nowIso(), last_used_at: null };
  await env.DB.prepare(`INSERT INTO api_keys (user_id, key_hash, hint, created_at, last_used_at, rl_min, rl_n) VALUES (?, ?, ?, ?, NULL, NULL, 0)
    ON CONFLICT(user_id) DO UPDATE SET key_hash = excluded.key_hash, hint = excluded.hint, created_at = excluded.created_at,
    last_used_at = NULL, rl_min = NULL, rl_n = 0`).bind(U, await sha256(key), row.hint, row.created_at).run();
  return { ...keyOut(row), key };
}

export async function apiKeyRevoke(env, U) {
  await ensureTable(env);
  await env.DB.prepare('DELETE FROM api_keys WHERE user_id = ?').bind(U).run();
  return { exists: false };
}

// ── 对外接口：GET /api/v1/export ──
function unauthorized(msg) {
  return json({ error: msg }, 401, { 'www-authenticate': 'Bearer realm="huixin"' });
}

export async function exportApi(req, env, ctx, url) {
  if (req.method !== 'GET') return json({ error: '只能用 GET 读取，这个接口不能修改数据' }, 405, { allow: 'GET' });
  const auth = req.headers.get('authorization') || '';
  const m = auth.match(/^Bearer\s+(\S+)$/i);
  if (!m) return unauthorized('缺少密钥：请在请求头里带上 Authorization: Bearer <你的密钥>');
  const key = m[1];
  if (!/^hx_[A-Za-z0-9_-]{20,100}$/.test(key)) return unauthorized('密钥不对，或者已经作废');
  await ensureTable(env);
  const hash = await sha256(key);
  const row = await env.DB.prepare('SELECT user_id, rl_min, rl_n FROM api_keys WHERE key_hash = ?').bind(hash).first();
  if (!row) return unauthorized('密钥不对，或者已经作废');

  // 轻量限频：同一把密钥每分钟最多 RATE_PER_MIN 次
  const now = nowIso();
  const minute = now.slice(0, 16);
  const n = row.rl_min === minute ? row.rl_n : 0;
  if (n >= RATE_PER_MIN) return json({ error: `太频繁了，每分钟最多 ${RATE_PER_MIN} 次，请稍后再试` }, 429, { 'retry-after': '60' });
  ctx.waitUntil(env.DB.prepare('UPDATE api_keys SET last_used_at = ?, rl_min = ?, rl_n = ? WHERE key_hash = ?')
    .bind(now, minute, n + 1, hash).run().catch(e => console.error('api key touch', e.message)));

  const sinceQ = url.searchParams.get('since');
  if (sinceQ && !isDate(sinceQ)) return err('since 要写成 YYYY-MM-DD');
  const since = sinceQ || '0000-00-00';
  const typeQ = (url.searchParams.get('type') || '').split(',').map(s => s.trim()).filter(Boolean);
  const bad = typeQ.filter(t => !TYPES.includes(t));
  if (bad.length) return err(`type 只能是 ${TYPES.join(', ')}（可以用逗号分隔多个）`);
  const want = typeQ.length ? typeQ : TYPES;
  const U = row.user_id;
  const out = { app: '回信', source: 'web', generated_at: now, since: sinceQ || null, types: want };
  const q = (sql, ...args) => env.DB.prepare(sql).bind(...args).all().then(r => r.results);

  if (want.includes('letters')) {
    out.letters = (await q('SELECT date, text, reply, energy, mood, replied_at, updated_at FROM letters WHERE user_id = ? AND date >= ? ORDER BY date', U, since))
      .map(r => ({ date: r.date, text: r.text, reply: parseJSON(r.reply), energy: r.energy, mood: r.mood, replied_at: r.replied_at, updated_at: r.updated_at }));
  }
  if (want.includes('todos')) {
    out.todos = (await q(`SELECT * FROM todos WHERE user_id = ? AND (created >= ? OR substr(updated_at, 1, 10) >= ?) ORDER BY created`, U, since, since))
      .map(r => ({ id: r.id, text: r.text, due: r.due, done: !!r.done, done_at: r.done_at, dropped_at: r.dropped_at || null, archived: !!r.archived,
        note: r.note || '', source_date: r.source_date, created: r.created, updated_at: r.updated_at }));
  }
  if (want.includes('ideas')) {
    out.ideas = (await q(`SELECT * FROM ideas WHERE user_id = ? AND (created >= ? OR substr(updated_at, 1, 10) >= ?) ORDER BY created`, U, since, since))
      .map(r => ({ id: r.id, text: r.text, status: r.status, source_date: r.source_date, created: r.created, updated_at: r.updated_at }));
  }
  if (want.includes('habits')) {
    out.habits = (await q('SELECT id, name, sort, archived, created FROM habits WHERE user_id = ? ORDER BY sort, created', U))
      .map(h => ({ id: h.id, name: h.name, sort: h.sort, archived: !!h.archived, created: h.created }));
    out.habit_logs = await q('SELECT habit_id, date FROM habit_logs WHERE user_id = ? AND date >= ? ORDER BY date', U, since);
  }
  if (want.includes('digests')) {
    out.digests = (await q('SELECT kind, key, content, created_at FROM digests WHERE user_id = ? AND substr(created_at, 1, 10) >= ? ORDER BY created_at', U, since))
      .map(d => ({ kind: d.kind, key: d.key, created_at: d.created_at, ...(parseJSON(d.content, {}) || {}) }));
  }
  return json(out);
}

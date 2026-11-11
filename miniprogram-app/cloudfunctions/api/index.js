// 只读 API：设置里生成密钥，用户自己的 agent 或工具凭密钥读取自己的数据。
// 两种调用：
//   1. 小程序里（有 OPENID）：event.action = status / create / revoke，管理自己的密钥
//   2. 外部 HTTP（云开发 HTTP 访问服务，event 里有 httpMethod）：GET + Authorization: Bearer <密钥>
// 库里只存密钥的 SHA-256，完整密钥只在生成那一刻返回一次。接口只能读，没有写入。
const cloud = require('wx-server-sdk');
const crypto = require('crypto');

cloud.init({ env: 'huixin-d1g2tdmkz68dc5a5d' });
const db = cloud.database();
const _ = db.command;

const COLL = 'api_keys';
const RATE_PER_MIN = 30;                    // 每把密钥每分钟最多 30 次
const MAX_BODY = 1000000;                   // HTTP 访问服务单次响应上限按 1MB 算
const TYPES = ['letters', 'todos', 'ideas', 'habits', 'digests'];

function sha256(s) { return crypto.createHash('sha256').update(s).digest('hex'); }
function b64url(buf) { return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function isDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')); }

function keyOut(row) {
  if (!row) return { exists: false };
  return { exists: true, hint: row.hint, created_at: row.created_at, last_used_at: row.last_used_at || null };
}

async function mine(openid) {
  try {
    const res = await db.collection(COLL).where({ _openid: openid }).limit(20).get();
    return res.data || [];
  } catch (e) {
    return [];   // 集合还没建
  }
}

async function removeMine(openid) {
  const rows = await mine(openid);
  await Promise.all(rows.map(r => db.collection(COLL).doc(r._id).remove()));
}

// ── 小程序里：查看 / 生成 / 作废 ──
async function manage(openid, action) {
  const url = process.env.API_URL || '';
  if (action === 'status') {
    const rows = await mine(openid);
    return Object.assign({ ok: true, url: url }, keyOut(rows[0]));
  }
  if (action === 'create') {
    try { await db.createCollection(COLL); } catch (e) { /* 已经有了 */ }
    await removeMine(openid);   // 每人一把：生成新的同时作废旧的
    const key = 'hx_' + b64url(crypto.randomBytes(32));
    const row = { _openid: openid, key_hash: sha256(key), hint: key.slice(0, 7), created_at: new Date().toISOString(), last_used_at: '', rl_min: '', rl_n: 0 };
    await db.collection(COLL).add({ data: row });
    return Object.assign({ ok: true, url: url, key: key }, keyOut(row));
  }
  if (action === 'revoke') {
    await removeMine(openid);
    return { ok: true, url: url, exists: false };
  }
  return { ok: false, code: 'bad', message: '不认识的操作' };
}

// ── 外部 HTTP：GET /api/v1/export ──
function reply(status, data, extra) {
  return {
    statusCode: status,
    headers: Object.assign({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, extra || {}),
    body: typeof data === 'string' ? data : JSON.stringify(data),
  };
}
function unauthorized(msg) { return reply(401, { error: msg }, { 'www-authenticate': 'Bearer realm="huixin"' }); }

function header(headers, name) {
  const h = headers || {};
  const k = Object.keys(h).find(x => x.toLowerCase() === name);
  return k ? String(h[k]) : '';
}

async function allRows(coll, openid) {
  const rows = [];
  for (let skip = 0, n = 0; n < 50; n++) {
    let res;
    try { res = await db.collection(coll).where({ _openid: openid }).skip(skip).limit(1000).get(); }
    catch (e) { break; }
    const batch = (res && res.data) || [];
    batch.forEach(r => rows.push(r));
    if (batch.length < 1000) break;
    skip += batch.length;
  }
  return rows;
}

const byKey = k => (a, b) => (String(a[k] || '') < String(b[k] || '') ? -1 : String(a[k] || '') > String(b[k] || '') ? 1 : 0);
const day = s => String(s || '').slice(0, 10);

async function exportApi(event) {
  if (String(event.httpMethod || '').toUpperCase() !== 'GET') {
    return reply(405, { error: '只能用 GET 读取，这个接口不能修改数据' }, { allow: 'GET' });
  }
  const m = header(event.headers, 'authorization').match(/^Bearer\s+(\S+)$/i);
  if (!m) return unauthorized('缺少密钥：请在请求头里带上 Authorization: Bearer <你的密钥>');
  const key = m[1];
  if (!/^hx_[A-Za-z0-9_-]{20,100}$/.test(key)) return unauthorized('密钥不对，或者已经作废');
  const hash = sha256(key);
  let row = null;
  try {
    const res = await db.collection(COLL).where({ key_hash: hash }).limit(1).get();
    row = (res.data && res.data[0]) || null;
  } catch (e) { row = null; }
  if (!row || !row._openid) return unauthorized('密钥不对，或者已经作废');

  // 轻量限频
  const now = new Date().toISOString();
  const minute = now.slice(0, 16);
  const n = row.rl_min === minute ? (row.rl_n || 0) : 0;
  if (n >= RATE_PER_MIN) return reply(429, { error: '太频繁了，每分钟最多 ' + RATE_PER_MIN + ' 次，请稍后再试' }, { 'retry-after': '60' });
  await db.collection(COLL).doc(row._id).update({ data: { last_used_at: now, rl_min: minute, rl_n: n + 1 } }).catch(() => {});

  const q = event.queryStringParameters || {};
  const sinceQ = q.since || '';
  if (sinceQ && !isDate(sinceQ)) return reply(400, { error: 'since 要写成 YYYY-MM-DD' });
  const since = sinceQ || '0000-00-00';
  const typeQ = String(q.type || '').split(',').map(s => s.trim()).filter(Boolean);
  const bad = typeQ.filter(t => TYPES.indexOf(t) < 0);
  if (bad.length) return reply(400, { error: 'type 只能是 ' + TYPES.join(', ') + '（可以用逗号分隔多个）' });
  const want = typeQ.length ? typeQ : TYPES;
  const U = row._openid;
  const out = { app: '回信', source: 'miniprogram', generated_at: now, since: sinceQ || null, types: want };

  if (want.indexOf('letters') >= 0) {
    out.letters = (await allRows('letters', U)).filter(r => isDate(r.date) && r.date >= since).sort(byKey('date')).map(r => ({
      date: r.date, text: r.text || '', reply: r.reply || null, energy: r.energy == null ? null : r.energy, mood: r.mood || null,
      replied_at: r.replied_at || null, updated_at: r.updated_at || null,
    }));
  }
  if (want.indexOf('todos') >= 0) {
    out.todos = (await allRows('todos', U)).filter(r => (r.created || '') >= since || day(r.updated_at) >= since).sort(byKey('created')).map(r => ({
      id: r.id, text: r.text || '', due: r.due || null, done: !!r.done, done_at: r.done_at || null, dropped_at: r.dropped_at || null,
      archived: !!r.archived, note: r.note || '', source_date: r.source_date || null, created: r.created || null, updated_at: r.updated_at || null,
    }));
  }
  if (want.indexOf('ideas') >= 0) {
    out.ideas = (await allRows('ideas', U)).filter(r => (r.created || '') >= since || day(r.updated_at) >= since).sort(byKey('created')).map(r => ({
      id: r.id, text: r.text || '', status: r.status || 'open', source_date: r.source_date || null, created: r.created || null, updated_at: r.updated_at || null,
    }));
  }
  if (want.indexOf('habits') >= 0) {
    out.habits = (await allRows('habits', U)).sort(byKey('created')).sort((a, b) => (a.sort || 0) - (b.sort || 0)).map(h => ({
      id: h.id, name: h.name || '', sort: h.sort || 0, archived: !!h.archived, created: h.created || null,
    }));
    out.habit_logs = (await allRows('habit_logs', U)).filter(r => r.done !== false && isDate(r.date) && r.date >= since).sort(byKey('date'))
      .map(r => ({ habit_id: r.habit_id, date: r.date }));
  }
  if (want.indexOf('digests') >= 0) {
    out.digests = (await allRows('digests', U)).filter(r => day(r.created_at) >= since).sort(byKey('created_at'))
      .map(d => Object.assign({ kind: d.kind, key: d.key, created_at: d.created_at || null }, d.content || {}));
  }
  const body = JSON.stringify(out);
  if (Buffer.byteLength(body) > MAX_BODY) {
    return reply(413, { error: '数据太多，一次装不下。请加上 since=YYYY-MM-DD 或 type=letters 这样分几次读' });
  }
  return reply(200, body);
}

exports.main = async (event) => {
  if (event && event.httpMethod) {
    try { return await exportApi(event); }
    catch (e) { console.error(e); return reply(500, { error: '服务器出错了，请稍后再试' }); }
  }
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { ok: false, code: 'auth', message: '没有微信身份' };
  try { return await manage(OPENID, event && event.action); }
  catch (e) { console.error(e); return { ok: false, code: 'error', message: '没办成，请稍后再试' }; }
};

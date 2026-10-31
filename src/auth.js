// 回信 · 登录
// 密码：PBKDF2-SHA256（10 万次）+ 随机盐；会话：随机令牌，库里只存它的哈希
import { json, err } from './util.js';

const COOKIE = 'hx_session';
const SESSION_DAYS = 180;
const ITER = 100000;

const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const fromHex = s => new Uint8Array(s.match(/.{2}/g).map(h => parseInt(h, 16)));

export async function hashPassword(password, saltHex) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(saltHex), iterations: ITER }, key, 256);
  return hex(bits);
}

async function sha256(s) {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function readCookie(req) {
  const c = req.headers.get('cookie') || '';
  const m = c.match(new RegExp('(?:^|;\\s*)' + COOKIE + '=([^;]+)'));
  return m ? m[1] : null;
}

function cookieHeader(value, maxAge) {
  return `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export async function currentUser(req, env) {
  const token = readCookie(req);
  if (!token) return null;
  const row = await env.DB.prepare(
    `SELECT u.id, u.username, u.name, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ?`).bind(await sha256(token)).first();
  if (!row || row.expires_at < Date.now()) return null;
  return { id: row.id, username: row.username, name: row.name };
}

export async function login(req, env) {
  const body = await req.json().catch(() => ({}));
  const username = String(body.username || '').trim();
  const password = String(body.password || '');
  if (!username || !password) return err('请输入账号和密码');

  const u = await env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(username).first();
  const ok = u && safeEqual(await hashPassword(password, u.salt), u.pass_hash);
  if (!ok) {
    await new Promise(r => setTimeout(r, 600));   // 放慢一点，挡住暴力猜密码
    return err('账号或密码不对', 401);
  }

  const raw = new Uint8Array(32);
  crypto.getRandomValues(raw);
  const token = hex(raw);
  const expires = Date.now() + SESSION_DAYS * 86400e3;
  await env.DB.batch([
    env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(Date.now()),
    env.DB.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
      .bind(await sha256(token), u.id, expires),
  ]);
  return json({ ok: true, user: { id: u.id, username: u.username, name: u.name } }, 200,
    { 'set-cookie': cookieHeader(token, SESSION_DAYS * 86400) });
}

export async function logout(req, env) {
  const token = readCookie(req);
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run();
  return json({ ok: true }, 200, { 'set-cookie': cookieHeader('', 0) });
}

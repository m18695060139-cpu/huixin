// 回信 · 公共小工具

// 所有「哪一天」都按北京时间算
export function cstDate(d = new Date()) {
  return new Date(d.getTime() + 8 * 3600e3).toISOString().slice(0, 10);
}

export function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// 这一周的周一
export function weekKey(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  const shift = (d.getUTCDay() + 6) % 7;
  return addDays(dateStr, -shift);
}

export function quarterKey(dateStr) {
  const m = Number(dateStr.slice(5, 7));
  return dateStr.slice(0, 4) + '-Q' + (Math.floor((m - 1) / 3) + 1);
}

// 季度 / 年 → [开始日期, 结束日期]
export function periodRange(kind, key) {
  if (kind === 'week') return [key, addDays(key, 6)];
  if (kind === 'quarter') {
    const y = key.slice(0, 4), q = Number(key.slice(-1));
    const sm = (q - 1) * 3 + 1;
    const start = `${y}-${String(sm).padStart(2, '0')}-01`;
    const endMonthFirst = q === 4 ? `${Number(y) + 1}-01-01` : `${y}-${String(sm + 3).padStart(2, '0')}-01`;
    return [start, addDays(endMonthFirst, -1)];
  }
  return [`${key}-01-01`, `${key}-12-31`];
}

export function uid(prefix = '') {
  const b = new Uint8Array(9);
  crypto.getRandomValues(b);
  return prefix + [...b].map(x => x.toString(36).padStart(2, '0')).join('').slice(0, 14);
}

export function nowIso() { return new Date().toISOString(); }

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

export function err(message, status = 400) {
  return json({ error: message }, status);
}

// 待办 / 点子去重：去掉标点空白再比较
export function norm(s) {
  return String(s || '').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
}

export function parseJSON(s, fallback = null) {
  try { return JSON.parse(s); } catch { return fallback; }
}

export function isDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')); }

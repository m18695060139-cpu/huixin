// 日子、凌晨 4 点换日、早上 6 点送达，一律按北京时间（UTC+8），不看手机时区。

function pad(n) {
  return (n < 10 ? '0' : '') + n;
}

function parts(d) {
  const u = new Date((d || new Date()).getTime() + 8 * 3600e3);
  return {
    y: u.getUTCFullYear(),
    m: u.getUTCMonth() + 1,
    day: u.getUTCDate(),
    h: u.getUTCHours(),
    min: u.getUTCMinutes(),
  };
}

function localDate(d) {
  const p = parts(d || new Date());
  return p.y + '-' + pad(p.m) + '-' + pad(p.day);
}

function addDays(s, n) {
  const d = new Date(s + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function diffDays(a, b) {
  return Math.round((new Date(a + 'T00:00:00Z') - new Date(b + 'T00:00:00Z')) / 86400e3);
}

const WD = ['日', '一', '二', '三', '四', '五', '六'];
function wd(s) {
  return WD[new Date(s + 'T00:00:00Z').getUTCDay()];
}

function cn(s) {
  return Number(s.slice(5, 7)) + '月' + Number(s.slice(8, 10)) + '日';
}

function hour(d) {
  return parts(d || new Date()).h;
}

function hm(d) {
  const p = parts(d || new Date());
  return pad(p.h) + ':' + pad(p.min);
}

function weekKey(s) {
  return addDays(s, -((new Date(s + 'T00:00:00Z').getUTCDay() + 6) % 7));
}

function today(now) {
  return localDate(now || new Date());
}

function letterDay(now) {
  now = now || new Date();
  return hour(now) < 4 ? addDays(today(now), -1) : today(now);
}

function cutoff(d) {
  return new Date(addDays(d, 1) + 'T04:00:00+08:00');
}

function deliverAt(d) {
  return new Date(addDays(d, 1) + 'T06:00:00+08:00');
}

function sendsTonight(d, now) {
  return (now || new Date()) < cutoff(d);
}

function hash(s) {
  let h = 2166136261;
  s = String(s || '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function isDate(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
}

module.exports = {
  pad, localDate, addDays, diffDays, wd, cn, hour, hm, weekKey,
  today, letterDay, cutoff, deliverAt, sendsTonight, hash, isDate,
};

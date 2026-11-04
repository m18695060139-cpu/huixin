// 日子按手机本地时间算。使用时把手机时区设为北京时间，和网页版一致：凌晨 4 点前算前一天。

function pad(n) {
  return (n < 10 ? '0' : '') + n;
}

function localDate(d) {
  d = d || new Date();
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

function addDays(s, n) {
  const d = new Date(s + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return localDate(d);
}

function diffDays(a, b) {
  return Math.round((new Date(a + 'T00:00:00') - new Date(b + 'T00:00:00')) / 86400e3);
}

const WD = ['日', '一', '二', '三', '四', '五', '六'];
function wd(s) {
  return WD[new Date(s + 'T00:00:00').getDay()];
}

function cn(s) {
  return Number(s.slice(5, 7)) + '月' + Number(s.slice(8, 10)) + '日';
}

function hm(d) {
  return pad(d.getHours()) + ':' + pad(d.getMinutes());
}

function weekKey(s) {
  return addDays(s, -((new Date(s + 'T00:00:00').getDay() + 6) % 7));
}

function today(now) {
  return localDate(now || new Date());
}

function letterDay(now) {
  now = now || new Date();
  return now.getHours() < 4 ? addDays(today(now), -1) : today(now);
}

function cutoff(d) {
  return new Date(addDays(d, 1) + 'T04:00:00');
}

function deliverAt(d) {
  return new Date(addDays(d, 1) + 'T06:00:00');
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
  pad, localDate, addDays, diffDays, wd, cn, hm, weekKey,
  today, letterDay, cutoff, deliverAt, sendsTonight, hash, isDate,
};

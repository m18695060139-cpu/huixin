// 周信 / 季信 / 年信。每天北京时间 6:00 触发：周一送上周，季初送上季，元旦送去年。
// 提示词与网页版 src/ai.js 的 DIGEST_SYSTEM 一致。也可以由小程序手动让它现在写。
const cloud = require('wx-server-sdk');
const { guard } = require('./sec');
const { askWithUserAI } = require('./userai');

cloud.init({ env: 'huixin-d1g2tdmkz68dc5a5d', timeout: 60000 });
const db = cloud.database();
const _ = db.command;

const HUNYUAN_MODEL = 'hy3';
const HUNYUAN_FALLBACK = 'hy3-preview';

const DIGEST_SYSTEM = {
  week: `你收到一个人这一周每天写给自己的信（或信的摘要）、精力分、完成的待办、习惯打卡和还没动的点子。替他写一封"周信"。
只输出 JSON：{"title":"…","letter":"…","energy_note":"…","forgotten":["…"],"next":"…"}
规则：
1. title：这一周的一句话标题，12 字以内，具体，不要"充实的一周"这种空话。
2. letter：周信正文，第二人称"你"，250 字以内。先说这周实际做成了什么、精力主要花在哪，再说这周的状态起伏。素材太少就直说"这周的信不多，看不出趋势"，不要硬编。不说教、不喊口号、不堆排比。
3. energy_note：一句话说这周精力的规律（比如哪个时段低、被什么消耗），没规律就 ""。
4. forgotten：这周信里提过、但看起来没跟进的事或点子，最多 3 条，没有就 []。已经在【放下的待办】里的不算没跟进，那是他自己决定的。
   待办后面括号里的备注是他自己写的话：在 letter 里可以引用，放下的事可以简单提一句他放下了什么、为什么，不评判。
5. next：下周最值得做的一件事，15-30 字，必须能在信里找到依据，找不到就 ""。
只输出 JSON。`,
  quarter: `你收到一个人这一季度每天写给自己的信的摘要、精力分和完成情况。他有一套"人生系统"：健康打底 → 精力当引擎 → 驱动"事业成就"和"关系连接"两条燃料线 → 两条线的正反馈再滋养健康和精力。每季度梳理一次，四块各出一条小规划，并行推进。替他写一封"季信"。
只输出 JSON：{"title":"…","letter":"…","lenses":{"health":"…","energy":"…","career":"…","relation":"…"},"plans":{"health":"…","energy":"…","career":"…","relation":"…"}}
规则：
1. title：这一季的一句话标题，12 字以内。
2. letter：季信正文，第二人称，350 字以内，说清这一季的主线、转折和整体状态，只用信里有依据的事实。
3. lenses：四块各一段 60 字以内的梳理：现阶段怎么样 + 卡在哪。
4. plans：四块下个季度各一条小规划，具体、可执行、30 字以内，必须从梳理里来。
只输出 JSON。`,
  year: `你收到一个人这一年每天写给自己的信的摘要和他的季信。替他写一封"年信"。
只输出 JSON：{"title":"…","letter":"…","themes":["…"],"lenses":{"health":"…","energy":"…","career":"…","relation":"…"}}
规则：title 一句话 12 字以内；letter 第二人称 500 字以内，这一年的主线、做成的事、变化；themes 3-5 个这一年反复出现的主题词；lenses 健康/精力/事业/关系四块各一句年度回看。只用有依据的事实，不说教。只输出 JSON。`,
};

function isDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')); }
function addDays(s, n) {
  const d = new Date(s + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  const p = x => (x < 10 ? '0' : '') + x;
  return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate());
}
function cstToday() {
  const d = new Date(Date.now() + 8 * 3600e3);
  const p = x => (x < 10 ? '0' : '') + x;
  return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate());
}
function weekKey(s) {
  const d = new Date(s + 'T00:00:00Z');
  return addDays(s, -((d.getUTCDay() + 6) % 7));
}
function quarterKey(s) {
  const m = Number(s.slice(5, 7));
  return s.slice(0, 4) + '-Q' + (Math.floor((m - 1) / 3) + 1);
}
function periodRange(kind, key) {
  if (kind === 'week') return [key, addDays(key, 6)];
  if (kind === 'quarter') {
    const y = key.slice(0, 4);
    const q = Number(key.slice(-1));
    const sm = (q - 1) * 3 + 1;
    const start = y + '-' + String(sm).padStart(2, '0') + '-01';
    const endMonthFirst = q === 4 ? (Number(y) + 1) + '-01-01' : y + '-' + String(sm + 3).padStart(2, '0') + '-01';
    return [start, addDays(endMonthFirst, -1)];
  }
  return [key + '-01-01', key + '-12-31'];
}
function parseJSON(s) { try { return JSON.parse(s); } catch (e) { return null; } }
function extractJSON(txt) {
  const s = String(txt || '').replace(/^```(?:json)?/i, '').replace(/```$/, '');
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  const j = a >= 0 && b > a ? parseJSON(s.slice(a, b + 1)) : null;
  if (!j) throw new Error('AI 返回的格式不对');
  return j;
}
function textOf(res) {
  if (!res) return '';
  if (typeof res.text === 'string' && res.text.trim()) return res.text.trim();
  const choice = res.choices && res.choices[0];
  if (choice && choice.message && choice.message.content) return String(choice.message.content).trim();
  return '';
}
async function generate(messages, modelName) {
  const model = cloud.ai().createModel('cloudbase');
  const res = await model.generateText({ model: modelName, messages: messages, temperature: 0.6 }, { timeout: 50000 });
  if (res && res.error) throw res.error;
  const txt = textOf(res);
  if (!txt) throw new Error('混元没有返回内容');
  return txt;
}
async function ask(messages) {
  try { return { text: await generate(messages, HUNYUAN_MODEL), model: HUNYUAN_MODEL }; }
  catch (e) {
    const msg = String(e && (e.message || e.errMsg) || e);
    if (/quota|额度|429|exhaust/i.test(msg)) throw e;
    return { text: await generate(messages, HUNYUAN_FALLBACK), model: HUNYUAN_FALLBACK };
  }
}
async function listWhere(coll, where) {
  const out = [];
  for (let skip = 0; skip < 500; skip += 100) {
    const res = await db.collection(coll).where(where).skip(skip).limit(100).get();
    const rows = res.data || [];
    rows.forEach(r => out.push(r));
    if (rows.length < 100) break;
  }
  return out;
}

function inRange(start, end) {
  return _.gte(start).and(_.lte(end));
}

async function makeDigest(openid, kind, key) {
  if (kind === 'week') key = weekKey(isDate(key) ? key : cstToday());
  if (kind === 'quarter' && !/^\d{4}-Q[1-4]$/.test(key)) key = quarterKey(cstToday());
  if (kind === 'year' && !/^\d{4}$/.test(key)) key = cstToday().slice(0, 4);
  const range = periodRange(kind, key);
  const start = range[0];
  const end = range[1];
  const nextDay = addDays(end, 1);
  const letters = (await listWhere('letters', { _openid: openid, date: inRange(start, end) })).filter(l => String(l.text || '').trim());
  letters.sort((a, b) => a.date < b.date ? -1 : 1);
  if (!letters.length) return null;
  const settingsRes = await db.collection('settings').where({ _openid: openid }).limit(1).get();
  const settings = (settingsRes.data && settingsRes.data[0]) || {};
  const done = (await listWhere('todos', { _openid: openid, done_at: inRange(start, end) })).filter(t => t.done);
  const dropped = (await listWhere('todos', { _openid: openid, dropped_at: inRange(start, end) })).filter(t => t.dropped_at);
  const pending = (await listWhere('todos', { _openid: openid, updated_at: _.gte(start).and(_.lt(nextDay)) })).filter(t => !t.done && !t.dropped_at && t.note && String(t.updated_at || '').slice(0, 10) >= start && String(t.updated_at || '').slice(0, 10) <= end);
  const ideas = kind === 'week'
    ? (await listWhere('ideas', { _openid: openid, status: 'open', created: _.lte(end) })).filter(i => i.created && i.created <= end).slice(0, 8)
    : [];
  const habits = await listWhere('habits', { _openid: openid });
  const logs = await listWhere('habit_logs', { _openid: openid, date: inRange(start, end) });
  const per = kind === 'week' ? 900 : kind === 'quarter' ? 220 : 90;
  const lines = ['【时间】' + start + ' 至 ' + end, '【他的名字】' + (settings.name || '（未设置）'), '【每天的信】'];
  letters.forEach(l => {
    const body = kind === 'week' ? l.text : ((l.reply && l.reply.summary) || l.text);
    lines.push(l.date + (l.energy ? ' · 精力 ' + l.energy + '/5' : '') + (l.mood ? ' · ' + l.mood : '') + '\n' + String(body).slice(0, per));
  });
  lines.push('【完成的待办】' + (done.length ? '\n' + done.map(t => '- ' + t.text + (t.note ? '（他的备注：' + String(t.note).slice(0, 120) + '）' : '')).join('\n') : '（无）'));
  if (dropped.length) lines.push('【放下的待办（决定不做或做不了）】\n' + dropped.map(t => '- ' + t.text + (t.note ? '（原因 / 备注：' + String(t.note).slice(0, 120) + '）' : '')).join('\n'));
  if (pending.length) lines.push('【还在做的待办和他写的备注】\n' + pending.map(t => '- ' + t.text + '：' + String(t.note).slice(0, 120)).join('\n'));
  const days = Math.round((new Date(end + 'T00:00:00Z') - new Date(start + 'T00:00:00Z')) / 86400e3) + 1;
  const active = habits.filter(h => !h.archived);
  if (active.length) {
    lines.push('【习惯打卡】\n' + active.map(h => {
      const n = logs.filter(g => g.habit_id === h.id && g.date >= start && g.date <= end).length;
      return '- ' + h.name + '：' + n + ' / ' + days + ' 天';
    }).join('\n'));
  }
  if (kind === 'week' && ideas.length) {
    lines.push('【点子库里还没动的】\n' + ideas.map(i => '- ' + i.text + '（' + i.created + ' 记下）').join('\n'));
  }
  if (kind === 'year') {
    const qs = await listWhere('digests', { _openid: openid, kind: 'quarter', key: _.gte(key + '-').and(_.lt(key + '.')) });
    if (qs.length) lines.push('【这一年的季信】\n' + qs.map(q => q.key + '：' + ((q.content && q.content.letter) || '')).join('\n'));
  }
  const messages = [
    { role: 'system', content: DIGEST_SYSTEM[kind] },
    { role: 'user', content: lines.join('\n\n') },
  ];
  const asked = await askWithUserAI(db, openid, messages, ask, { maxTokens: kind === 'week' ? 3000 : 4500, temperature: 0.6, timeoutMs: 15000 });
  const content = extractJSON(asked.text);
  const sec = await guard(cloud.getWXContext().OPENID || openid, [content.letter, content.title, content.energy_note, content.next].concat(content.forgotten || [], content.themes || []));
  if (!sec.ok) throw new Error('内容没能保存');
  const energies = letters.filter(l => l.energy);
  const avg = energies.length ? Math.round(energies.reduce((s, l) => s + Number(l.energy), 0) / energies.length * 10) / 10 : null;
  content.engine = asked.engine || '';
  if (asked.ownError) content.ownError = asked.ownError;
  content.stats = { letters: letters.length, days: days, energyAvg: avg, todosDone: done.length };
  content.range = [start, end];
  const now = new Date().toISOString();
  const existingRes = await db.collection('digests').where({ _openid: openid, kind: kind, key: key }).limit(1).get();
  const existing = (existingRes.data && existingRes.data[0]) || null;
  const data = { kind: kind, key: key, content: content, created_at: now, _openid: openid };
  if (existing) await db.collection('digests').doc(existing._id).update({ data: { content: content, created_at: now } });
  else await db.collection('digests').add({ data: data });
  return { kind: kind, key: key, created_at: now, content: content };
}

async function distinctOpenids(coll) {
  const set = {};
  for (let skip = 0; skip < 2000; skip += 100) {
    const res = await db.collection(coll).where({ _id: _.exists(true) }).field({ _openid: true }).skip(skip).limit(100).get();
    const rows = res.data || [];
    rows.forEach(r => { if (r._openid) set[r._openid] = true; });
    if (rows.length < 100) break;
  }
  return Object.keys(set);
}

async function openids() {
  const fromSettings = await distinctOpenids('settings');
  if (fromSettings.length) return fromSettings;
  return distinctOpenids('letters');
}

async function deliverDue(today) {
  const jobs = [];
  const dow = new Date(today + 'T00:00:00Z').getUTCDay();
  if (dow === 1) jobs.push(['week', addDays(today, -7)]);
  if (today.slice(8) === '01' && ['01', '04', '07', '10'].indexOf(today.slice(5, 7)) >= 0) jobs.push(['quarter', quarterKey(addDays(today, -1))]);
  if (today.slice(5) === '01-01') jobs.push(['year', addDays(today, -1).slice(0, 4)]);
  if (!jobs.length) return { ok: true, skipped: true };
  const ids = await openids();
  for (let i = 0; i < ids.length; i++) {
    for (let j = 0; j < jobs.length; j++) {
      try { await makeDigest(ids[i], jobs[j][0], jobs[j][1]); }
      catch (e) { console.error('digest', ids[i], jobs[j], e && e.message); }
    }
  }
  return { ok: true, users: ids.length, jobs: jobs };
}

exports.main = async (event) => {
  try {
    if (event && (event.Type === 'Timer' || event.TriggerName)) return await deliverDue(cstToday());
    const { OPENID } = cloud.getWXContext();
    if (!OPENID) return { ok: false, message: '没有微信身份' };
    const kind = event && event.kind;
    if (['week', 'quarter', 'year'].indexOf(kind) < 0) return { ok: false, message: '类型不对' };
    const digest = await makeDigest(OPENID, kind, event.key || '');
    if (!digest) return { ok: false, message: '这段时间还没有信，写不出来' };
    return { ok: true, digest: digest };
  } catch (e) {
    console.error(e);
    const msg = String(e && e.message || '');
    if (/你自己的 AI 没接通/.test(msg)) return { ok: false, message: msg };
    return { ok: false, message: /quota|额度|429/.test(msg) ? '今天的免费额度用完了，明天再试。' : '这封总结信没写成，稍后再试。' };
  }
};

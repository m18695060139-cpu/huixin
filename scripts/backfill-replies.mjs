// 给还没有 AI 回信的旧信补写回信（比如从 Life OS 导入的信）
// 用法：node scripts/backfill-replies.mjs <用户名> [--weeks 2026-10-19,2026-10-26]
// 需要环境变量 CLOUDFLARE_API_TOKEN、CLOUDFLARE_ACCOUNT_ID（放在 .env.deploy）
//
// 和线上「寄出」的区别：
//   - 不拆待办：旧信里提到的事早就过去了，拆出来只会把做完的事又塞回待办
//   - 点子照常收进点子库
//   - 你自己答过的问题原样保留，只补空着的
import { writeReply, DEFAULT_QUESTIONS } from '../src/ai.js';
import { makeDigest } from '../src/worker.js';
import { norm, uid, nowIso, addDays } from '../src/util.js';

const ACC = process.env.CLOUDFLARE_ACCOUNT_ID, TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const DB_ID = '92ba5636-67f9-4746-a71b-9f7faee653f1';
const API = `https://api.cloudflare.com/client/v4/accounts/${ACC}`;
const H = { authorization: 'Bearer ' + TOKEN, 'content-type': 'application/json' };

async function q(sql, params = []) {
  const r = await fetch(`${API}/d1/database/${DB_ID}/query`, { method: 'POST', headers: H, body: JSON.stringify({ sql, params }) });
  const j = await r.json();
  if (!j.success) throw new Error(JSON.stringify(j.errors));
  return j.result[0].results;
}
// 让 worker.js 里的代码能直接用的 D1 替身
const DB = {
  prepare(sql) {
    const st = { params: [], bind(...p) { st.params = p; return st; },
      all: async () => ({ results: await q(sql, st.params) }),
      first: async () => (await q(sql, st.params))[0] || null,
      run: async () => q(sql, st.params), sql };
    return st;
  },
  async batch(list) { for (const s of list) await s.run(); },
};
const env = {
  DB,
  WORKERS_AI_MODEL: '@cf/openai/gpt-oss-120b',
  AI: { run: async (model, body) => {
    const r = await fetch(`${API}/ai/run/${model}`, { method: 'POST', headers: H, body: JSON.stringify(body) });
    const j = await r.json();
    if (!j.success) throw new Error(JSON.stringify(j.errors));
    return j.result;
  } },
};

const [username, ...rest] = process.argv.slice(2);
const weeksArg = rest.indexOf('--weeks') >= 0 ? rest[rest.indexOf('--weeks') + 1].split(',') : [];
const user = (await q('SELECT id, username, name FROM users WHERE username = ?', [username]))[0];
if (!user) throw new Error('没有这个用户');
const U = user.id;
const settings = JSON.parse(((await q('SELECT json FROM settings WHERE user_id = ?', [U]))[0] || { json: '{}' }).json);
const questions = Array.isArray(settings.questions) && settings.questions.length ? settings.questions : DEFAULT_QUESTIONS;

const letters = await q("SELECT date, text, reply FROM letters WHERE user_id = ? AND text != '' ORDER BY date", [U]);
const todo = letters.filter(l => { const r = JSON.parse(l.reply || 'null'); return !r || r.imported; });
console.log(`要补写 ${todo.length} 封：${todo.map(l => l.date).join(' ')}`);

let yesterday = '';
for (const l of todo) {
  const old = JSON.parse(l.reply || 'null') || {};
  const openTodos = (await q('SELECT text FROM todos WHERE user_id = ? AND done = 0 AND archived = 0', [U])).map(r => r.text);
  const ideas = (await q("SELECT text FROM ideas WHERE user_id = ? AND status = 'open'", [U])).map(r => r.text);
  const prev = (await q('SELECT reply FROM letters WHERE user_id = ? AND date = ?', [U, addDays(l.date, -1)]))[0];
  const prevSum = prev && prev.reply ? (JSON.parse(prev.reply).summary || '') : yesterday;
  const t0 = Date.now();
  let r;
  try {
    r = await writeReply(env, { name: user.name, date: l.date, today: l.date, backfill: false, text: l.text, questions, openTodos, ideas, yesterday: prevSum });
  } catch (e) { console.log(l.date, '失败：', e.message); continue; }

  // 你自己写过的答案优先
  const answers = questions.map((_, i) => (old.answers && old.answers[i]) ? old.answers[i] : '');
  const have = new Set(ideas.map(norm));
  const made = [];
  for (const it of r.ideas) {
    const k = norm(it.text);
    if (!k || have.has(k)) continue;
    have.add(k);
    const id = uid('i');
    await q("INSERT INTO ideas (id, user_id, text, status, source_date, created, updated_at) VALUES (?, ?, ?, 'open', ?, ?, ?)", [id, U, it.text, l.date, l.date, nowIso()]);
    made.push({ id, text: it.text });
  }
  const reply = { summary: r.summary, energy: r.energy, mood: r.mood, highlight: r.highlight, answers, questions, lenses: r.lenses, todos: [], ideas: made, backfilled: true };
  await q('UPDATE letters SET reply = ?, energy = ?, mood = ?, replied_at = ? WHERE user_id = ? AND date = ?',
    [JSON.stringify(reply), r.energy, r.mood, nowIso(), U, l.date]);
  yesterday = r.summary;
  console.log(`${l.date}  ${Math.round((Date.now() - t0) / 1000)}s  精力 ${r.energy} · ${r.mood}  点子 +${made.length}  ${r.summary.slice(0, 40)}…`);
}

for (const wk of weeksArg) {
  const d = await makeDigest(env, user, 'week', wk);
  console.log('周信', wk, d ? d.title : '（这周没有信）');
}

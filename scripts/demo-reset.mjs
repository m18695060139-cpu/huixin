// 重置示例账号：按「今天」（北京时间）重新铺一套演示数据：一个人五六周的信和回信、待办（还没做 / 过期 / 做完 / 放下）、
// 点子（还在 / 转成待办 / 放下）、四个习惯和打卡、五封周信、这一季和今年到目前为止的季信、年信。
// 内容在 scripts/demo-data.cjs，和小程序 cloudfunctions/demoSeed/data.js 是同一个文件，两边一模一样。
// 只动这个账号的数据，账号和密码不变。演示前跑一次，「昨晚的你来信了」就会在任何设备上重新出现。
//
// 用法：
//   node scripts/demo-reset.mjs <示例账号> [回信怎么称呼] > demo.sql
//   npx wrangler d1 execute huixin --remote --file demo.sql      （本地预览把 --remote 换成 --local）

import { createRequire } from 'node:module';
const { buildDemo } = createRequire(import.meta.url)('./demo-data.cjs');

const [username, name = ''] = process.argv.slice(2);
if (!username) {
  console.error('用法：node scripts/demo-reset.mjs <示例账号> [回信怎么称呼] > demo.sql');
  process.exit(1);
}

const q = s => (s == null || s === '' ? 'NULL' : "'" + String(s).replace(/'/g, "''") + "'");
const qs = s => "'" + String(s == null ? '' : s).replace(/'/g, "''") + "'";   // 不能为 NULL 的文本列
const U = `FROM users WHERE username = ${qs(username)}`;
const pack = buildDemo(Date.now(), name);
const now = new Date().toISOString();

const out = [`-- 示例账号：${username}（北京时间 ${pack.today} 生成）`];
for (const t of ['letters', 'todos', 'ideas', 'habits', 'habit_logs', 'digests', 'feedback']) {
  out.push(`DELETE FROM ${t} WHERE user_id = (SELECT id ${U});`);
}
for (const l of pack.letters) {
  out.push(`INSERT INTO letters (user_id, date, text, reply, energy, mood, replied_at, updated_at) SELECT id, ${qs(l.date)}, ${qs(l.text)}, ${qs(JSON.stringify(l.reply))}, ${l.energy}, ${q(l.mood)}, ${q(l.replied_at)}, ${qs(l.updated_at)} ${U};`);
}
for (const t of pack.todos) {
  out.push(`INSERT INTO todos (id, user_id, text, due, done, done_at, archived, source_date, created, updated_at, note, dropped_at) SELECT ${qs(t.id)}, id, ${qs(t.text)}, ${q(t.due)}, ${t.done ? 1 : 0}, ${q(t.done_at)}, 0, ${q(t.source_date)}, ${qs(t.created)}, ${qs(t.updated_at)}, ${qs(t.note)}, ${q(t.dropped_at)} ${U};`);
}
// 网页版放下的点子没有单独的日期列，「几月几日放下」读的是 updated_at
for (const i of pack.ideas) {
  out.push(`INSERT INTO ideas (id, user_id, text, status, source_date, created, updated_at) SELECT ${qs(i.id)}, id, ${qs(i.text)}, ${qs(i.status)}, ${q(i.source_date)}, ${qs(i.created)}, ${qs(i.updated_at)} ${U};`);
}
for (const h of pack.habits) {
  out.push(`INSERT INTO habits (id, user_id, name, sort, archived, created) SELECT ${qs(h.id)}, id, ${qs(h.name)}, ${h.sort}, 0, ${qs(h.created)} ${U};`);
}
for (const g of pack.logs) {
  out.push(`INSERT INTO habit_logs (user_id, habit_id, date) SELECT id, ${qs(g.habit_id)}, ${qs(g.date)} ${U};`);
}
for (const d of pack.digests) {
  out.push(`INSERT INTO digests (user_id, kind, key, content, created_at) SELECT id, ${qs(d.kind)}, ${qs(d.key)}, ${qs(JSON.stringify(d.content))}, ${qs(d.created_at || now)} ${U};`);
}

// DEMO_OUT=文件路径 时直接写文件（PowerShell 重定向会加 BOM，wrangler 读不了）
if (process.env.DEMO_OUT) (await import('node:fs')).writeFileSync(process.env.DEMO_OUT, out.join('\n') + '\n');
else process.stdout.write(out.join('\n') + '\n');
const c = k => pack.digests.filter(d => d.kind === k).length;
console.error(`已生成：${username} · ${pack.letters.length} 封信 · ${pack.todos.length} 件待办 · ${pack.ideas.length} 个点子 · ${pack.habits.length} 个习惯 · ${c('week')} 封周信 · ${c('quarter')} 封季信 · ${c('year')} 封年信（今天按北京时间是 ${pack.today}）`);

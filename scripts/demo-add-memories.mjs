// 只给示例账号补充长期记忆，不清空或覆盖现有信件、待办、点子和其他数据。
// 用法：node scripts/demo-add-memories.mjs <示例账号> > demo-memories.sql
// 执行：npx wrangler d1 execute huixin --remote --file demo-memories.sql

const [username] = process.argv.slice(2);
if (!username) {
  console.error('用法：node scripts/demo-add-memories.mjs <示例账号> > demo-memories.sql');
  process.exit(1);
}
const q = s => "'" + String(s).replace(/'/g, "''") + "'";
const pad = n => String(n).padStart(2, '0');
const bj = new Date(Date.now() + 8 * 3600e3);
const today = `${bj.getUTCFullYear()}-${pad(bj.getUTCMonth() + 1)}-${pad(bj.getUTCDate())}`;
const day = n => { const d = new Date(today + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const now = new Date().toISOString();
const U = `(SELECT id FROM users WHERE username = ${q(username)})`;
const memories = [
  ['value', '你很看重做事的自主性，也在意把时间花在真正重要的事情上。', [-1, -5, -18], 0.91],
  ['goal', '你想把读书会从线下活动逐步发展成一个稳定的内容项目。', [-9, -31], 0.88],
  ['preference', '比起长时间开会，你更喜欢短而明确、有结论的沟通方式。', [-1, -5, -16], 0.93],
  ['preference', '清晨阅读通常能让你进入比较专注的状态。', [-31, -34], 0.86],
  ['relationship', '小林是你重要的共创伙伴，你们正在尝试一起做读书会播客。', [-9, -14, -31], 0.90],
  ['relationship', '你希望更主动地联系老朋友，而不是只在想起时才联系。', [-14, -20], 0.82],
  ['work', '你近期持续在思考如何减少低效会议，并尝试推动周会改成短站会。', [-1, -5, -16], 0.94],
  ['pattern', '当工作压力变大时，跑步或出门走一走常常能帮助你恢复状态。', [-3, -14, -24], 0.89],
  ['pattern', '你有时会先把责任揽到自己身上，之后才意识到需要重新分配精力。', [-1, -5], 0.81],
  ['goal', '你想保持稳定的阅读和运动节奏，但也在练习不给自己安排过多目标。', [-14, -24, -31], 0.84],
  ['other', '你喜欢把模糊的想法先写下来，再通过小步骤验证，而不是一开始就做很大的计划。', [-1, -9, -18], 0.83],
];
const out = [`-- 仅追加到示例账号 ${username}；已存在的同内容记忆会跳过`];
for (const [category, content, offsets, confidence] of memories) {
  const id = 'm_demo_' + category + '_' + memories.indexOf(memories.find(x => x[1] === content));
  const evidence = offsets.map(day);
  out.push(`INSERT INTO memories (id, user_id, category, content, evidence_dates, confidence, status, created_at, updated_at)
SELECT ${q(id)}, id, ${q(category)}, ${q(content)}, ${q(JSON.stringify(evidence))}, ${confidence}, 'active', ${q(now)}, ${q(now)}
FROM users
WHERE username = ${q(username)}
AND NOT EXISTS (SELECT 1 FROM memories WHERE user_id = users.id AND content = ${q(content)} AND status = 'active');`);
}
process.stdout.write(out.join('\n') + '\n');
console.error(`已准备 ${memories.length} 条示例长期记忆（北京时间 ${today}）；执行 SQL 后不会删除现有演示数据。`);

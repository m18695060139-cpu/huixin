// 只检查提示词文本、旧基线和整理默认值。不调用模型，也不能当成效果已经验证。
const assert = require('assert');
const test = require('node:test');
const reply = require('./reply-source');
const digest = require('./digest-source');
const oldPrompt = require('./published-480f2da');
const previewReply = require('../cloudfunctions/promptPreview/reply-source');
const previewDigest = require('../cloudfunctions/promptPreview/digest-source');
const previewOld = require('../cloudfunctions/promptPreview/published-480f2da');
const preview = require('./preview');

test('published baseline stays verbatim and the candidate copy is separate', () => {
  assert.equal(previewOld.REPLY_SYSTEM, oldPrompt.REPLY_SYSTEM);
  assert.equal(previewOld.DIGEST_SYSTEM.week, oldPrompt.DIGEST_SYSTEM.week);
  assert.equal(previewOld.DIGEST_SYSTEM.quarter, oldPrompt.DIGEST_SYSTEM.quarter);
  assert.equal(previewOld.DIGEST_SYSTEM.year, oldPrompt.DIGEST_SYSTEM.year);
  assert.match(oldPrompt.REPLY_SYSTEM, /最后一句点一下今天的整体状态（精力、情绪、节奏）。/);
  assert.match(oldPrompt.DIGEST_SYSTEM.week, /先说这周实际做成了什么、精力主要花在哪/);
  assert.doesNotMatch(oldPrompt.REPLY_SYSTEM, /不要把 energy、mood 的默认值说成看到的事实/);
  assert.notEqual(reply.REPLY_SYSTEM, oldPrompt.REPLY_SYSTEM);
  assert.equal(previewReply.REPLY_SYSTEM, reply.REPLY_SYSTEM);
  assert.equal(previewDigest.DIGEST_SYSTEM.week, digest.DIGEST_SYSTEM.week);
  assert.equal(previewDigest.DIGEST_SYSTEM.quarter, digest.DIGEST_SYSTEM.quarter);
  assert.equal(previewDigest.DIGEST_SYSTEM.year, digest.DIGEST_SYSTEM.year);
});

test('daily candidate keeps schema and defaults, and does not narrate them', () => {
  const s = reply.REPLY_SYSTEM;
  assert.match(s, /"summary":"…","energy":3,"mood":"平静"/);
  assert.match(s, /"tasks":\[\{"text":"…","dueDays":3\}\]/);
  assert.match(s, /"ideas":\[\{"text":"…"\}\]/);
  assert.match(s, /200 到 350 字/);
  assert.match(s, /完全没线索就给 3/);
  assert.match(s, /没有就小事 1-2、正常 3、大工程 7/);
  assert.match(s, /信里自己写了精力、情绪或节奏，最后一句才可以点一下/);
  assert.match(s, /不要把 energy、mood 的默认值说成看到的事实/);
  assert.doesNotMatch(s, /要是能请一周假|阳台那盏灯/);
  const made = reply.normalizeReply({ summary: '只是想想。' });
  assert.equal(made.energy, 3);
  assert.equal(made.mood, '平静');
  assert.equal(made.tasks.length, 0);
  assert.equal(reply.normalizeReply({ summary: 'x', tasks: [{ text: '换掉阳台那盏灯' }] }).tasks[0].dueDays, 3);
});

test('the supplied week fixture still separates the April 2 energy score from mood', () => {
  const pair = preview.pairFor({ fixture: 'week' });
  const user = pair.newMessages[1].content;
  assert.equal(pair.oldMessages[1].content, user);
  assert.match(user, /2026-04-02 · 精力 1\/5 · 低落\n今天什么都不想做，饭也没吃。/);
});

test('period candidates keep fields and only narrow evidence, time and attribution', () => {
  const week = digest.DIGEST_SYSTEM.week;
  const quarter = digest.DIGEST_SYSTEM.quarter;
  const year = digest.DIGEST_SYSTEM.year;
  assert.match(week, /"forgotten":\["…"\]/);
  assert.match(week, /下周最值得做的一件事，15-30 字/);
  assert.match(week, /250 字以内/);
  assert.match(week, /这周的信不多，看不出趋势/);
  assert.match(week, /不要新编一件他没写过的事/);
  assert.match(week, /只写这一个动作，句子要写完/);
  assert.match(week, /不要用「并」再接购买、准备或其他第二个动作/);
  assert.match(week, /不要从「下班」或买东西推断上班消耗/);
  assert.match(week, /没有精力分、也没写被什么消耗，就 ""/);
  assert.match(quarter, /"plans":\{"health"/);
  assert.match(quarter, /350 字以内/);
  assert.match(quarter, /30 字以内/);
  assert.match(quarter, /60 字以内/);
  assert.match(quarter, /没记下不等于没做成/);
  assert.match(quarter, /这季度信里这方面很少/);
  assert.match(quarter, /不要把一条完成记录说成整季只有这一件/);
  assert.match(year, /"themes":\["…"\]/);
  assert.match(year, /500 字以内/);
  assert.match(year, /季信提到/);
  assert.match(year, /没有日期的完成项不要安到另一封信的日期上/);
  assert.match(year, /没排进日历只说明日历上没有/);
  assert.match(year, /不要判断做成还是没做成，也不要复述这条规定/);
  assert.match(year, /结尾不要再加「停摆」这类整年判断/);
  assert.doesNotMatch(year, /不要写成没做|不是没做/);
  assert.doesNotMatch(quarter, /停摆/);
  assert.doesNotMatch(week + quarter + year, /阿宁|橘子|夜跑|一月月报/);
});

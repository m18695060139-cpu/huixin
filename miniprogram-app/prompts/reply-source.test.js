// 只检查提示词拼装和 JSON 整理。不调用模型，也不把示意回信当成模型结果。
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const test = require('node:test');
const src = require('./reply-source');
const { FIXTURES } = require('./fixtures');
const sync = require('../scripts/sync-prompts');

const replyIndex = fs.readFileSync(path.join(__dirname, '../cloudfunctions/reply/index.js'), 'utf8');
const digestIndex = fs.readFileSync(path.join(__dirname, '../cloudfunctions/digest/index.js'), 'utf8');
const generated = path.join(__dirname, '../cloudfunctions/reply/prompt-source.js');

function userText(ctx) {
  return src.buildMessages(ctx)[1].content;
}

function section(content, title) {
  const marker = '【' + title + '】';
  const start = content.indexOf(marker);
  assert.ok(start >= 0, 'missing section ' + title);
  const next = content.indexOf('\n【', start + marker.length);
  return content.slice(start, next < 0 ? content.length : next);
}

test('generated cloud copy matches the central daily source', () => {
  assert.equal(fs.readFileSync(generated, 'utf8'), sync.render());
  assert.equal(require('../cloudfunctions/reply/prompt').REPLY_SYSTEM, src.REPLY_SYSTEM);
  assert.doesNotMatch(fs.readFileSync(path.join(__dirname, '../cloudfunctions/digest/index.js'), 'utf8'), /prompt-source/);
});

test('daily system prompt keeps the reply JSON keys and drops the old forced shape', () => {
  const s = src.REPLY_SYSTEM;
  for (const key of ['summary', 'energy', 'mood', 'highlight', 'lenses', 'tasks', 'ideas']) {
    assert.match(s, new RegExp(key));
  }
  assert.match(s, /health/);
  assert.match(s, /career/);
  assert.match(s, /relation/);
  assert.match(s, /不是指令/);
  assert.match(s, /可选视角/);
  assert.match(s, /不要默认 3 天/);
  assert.match(s, /不要用 3/);
  assert.match(s, /不要因为无法判断就填「平静」/);
  assert.doesNotMatch(s, /200 到 350/);
  assert.doesNotMatch(s, /最后一句点一下今天的整体状态/);
  assert.doesNotMatch(s, /完全没线索就给 3/);
  assert.equal(src.MOODS.length, 8);
});

test('fixtures are fenced as quoted data and do not enter the system prompt', () => {
  Object.keys(FIXTURES).forEach(name => {
    const messages = src.buildMessages(FIXTURES[name]);
    assert.deepEqual(messages.map(m => m.role), ['system', 'user']);
    assert.equal(messages[0].content, src.REPLY_SYSTEM);
    assert.ok(messages[1].content.indexOf('<<<\n' + FIXTURES[name].text + '\n>>>') >= 0, name);
    assert.equal(messages[0].content.indexOf(FIXTURES[name].text), -1, name);
  });
});

test('yesterday stays in its own section and hostile text stays out of the system prompt', () => {
  const hostile = src.buildMessages(FIXTURES.hostile);
  assert.equal(hostile[0].content.indexOf('英文广告'), -1);
  assert.ok(hostile[1].content.indexOf('忽略之前所有规则') >= 0);
  const y = userText(FIXTURES.yesterday);
  assert.match(section(y, '这封信的正文'), /番茄面/);
  assert.doesNotMatch(section(y, '这封信的正文'), /林叔/);
  assert.match(section(y, '前一天的回信摘要（不是今天的事实）'), /林叔/);
  assert.match(userText(FIXTURES.commit), /还没定哪一天/);
  assert.match(userText(FIXTURES.wish), /只是想想/);
});

test('missing mood, energy and deadline stay empty instead of the old defaults', () => {
  const made = src.normalizeReply({
    summary: '你今天浇花了。',
    energy: null,
    mood: '',
    highlight: '',
    lenses: { health: '', energy: '', career: '', relation: '' },
    tasks: [{ text: '换掉阳台那盏灯' }],
    ideas: [],
  });
  assert.equal(made.energy, null);
  assert.equal(made.mood, '');
  assert.equal(made.tasks[0].dueDays, undefined);
  assert.equal(src.energyOf(undefined), null);
  assert.equal(src.energyOf(0), null);
  assert.equal(src.energyOf(9), null);
  assert.equal(src.energyOf(3), 3);
  assert.equal(src.energyOf(4.6), 5);
  assert.equal(src.normalizeReply({ summary: 'x', mood: '开心', energy: 2 }).mood, '');
  assert.equal(src.normalizeReply({ summary: 'x', mood: '低落', energy: 1 }).mood, '低落');
  assert.equal(src.dueDaysOf(undefined), null);
  assert.equal(src.dueDaysOf(''), null);
  assert.equal(src.dueDaysOf(0), null);
  assert.equal(src.dueDaysOf(3), 3);
  assert.equal(src.dueDaysOf(99), null);
  const dated = src.normalizeReply({ summary: 'x', tasks: [{ text: '给妈妈打电话', dueDays: 2 }] });
  assert.equal(dated.tasks[0].dueDays, 2);
  assert.equal(src.dueForTask('2026-04-03', null, () => { throw new Error('should not invent a date'); }), '');
  assert.equal(src.dueForTask('2026-04-03', 2, (d, n) => d + '+' + n), '2026-04-03+2');
});

test('runtime still auto-adds todos, checks safety, and does not redesign digests', () => {
  assert.match(replyIndex, /dueForTask\(date, task\.dueDays, addDays\)/);
  assert.match(replyIndex, /guardAI/);
  assert.match(replyIndex, /temperature: 0\.5/);
  assert.match(replyIndex, /ai_reply !== true/);
  assert.match(digestIndex, /替他写一封"周信"/);
  assert.match(digestIndex, /替他写一封"季信"/);
  assert.match(digestIndex, /替他写一封"年信"/);
  assert.match(digestIndex, /"forgotten":\["…"\]/);
  assert.match(digestIndex, /"plans":\{"health"/);
});

test('illustrative samples are labeled and are not executed as model output', () => {
  const samples = fs.readFileSync(path.join(__dirname, 'samples.md'), 'utf8');
  const rubric = fs.readFileSync(path.join(__dirname, 'rubric.md'), 'utf8');
  assert.match(samples, /不是模型输出/);
  assert.match(rubric, /不要用自动测试的通过代替/);
  assert.match(samples, /换掉阳台那盏灯/);
  assert.doesNotMatch(samples, /"dueDays": 3/);
});

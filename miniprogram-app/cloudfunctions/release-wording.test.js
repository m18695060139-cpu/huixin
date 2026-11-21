// 正式版提示词必须等于 fad76c8 的候选说法。不调用模型，也不读取密钥。
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const test = require('node:test');
const reply = require('./reply/prompt');

const root = __dirname;
const digestSrc = fs.readFileSync(path.join(root, 'digest/index.js'), 'utf8');
const replyIndex = fs.readFileSync(path.join(root, 'reply/index.js'), 'utf8');
const digestConfig = JSON.parse(fs.readFileSync(path.join(root, 'digest/config.json'), 'utf8'));
const replyConfig = JSON.parse(fs.readFileSync(path.join(root, 'reply/config.json'), 'utf8'));
const app = JSON.parse(fs.readFileSync(path.join(root, '../miniprogram/app.json'), 'utf8'));
const settings = fs.readFileSync(path.join(root, '../miniprogram/pages/settings/settings.wxml'), 'utf8');

const ctx = {
  name: '甲',
  date: '2026-04-03',
  today: '2026-04-03',
  backfill: false,
  text: '今天浇花了。',
  questions: null,
  openTodos: [],
  ideas: [],
  notes: [],
  yesterday: '',
};

test('daily wording is the fad76c8 candidate and defaults stay published', () => {
  const system = reply.buildMessages(ctx)[0].content;
  assert.match(system, /信里自己写了精力、情绪或节奏，最后一句才可以点一下/);
  assert.match(system, /不要把 energy、mood 的默认值说成看到的事实/);
  assert.doesNotMatch(system, /最后一句点一下今天的整体状态（精力、情绪、节奏）。/);
  assert.match(system, /200 到 350 字/);
  assert.match(system, /完全没线索就给 3/);
  assert.match(system, /没有就小事 1-2、正常 3、大工程 7/);
  assert.equal(reply.HUNYUAN_MODEL, 'hy3');
  assert.equal(reply.HUNYUAN_FALLBACK, 'hy3-preview');
  assert.equal(reply.DEFAULT_QUESTIONS.length, 7);
  const made = reply.normalizeReply({ summary: '只是想想。', tasks: [{ text: '换掉阳台那盏灯' }] });
  assert.equal(made.energy, 3);
  assert.equal(made.mood, '平静');
  assert.equal(made.tasks[0].dueDays, 3);
});

test('week, quarter and year wording is the fad76c8 candidate', () => {
  assert.match(digestSrc, /不要从「下班」或买东西推断上班消耗/);
  assert.match(digestSrc, /只写这一个动作，句子要写完/);
  assert.match(digestSrc, /不要用「并」再接购买、准备或其他第二个动作/);
  assert.match(digestSrc, /下周最值得做的一件事，15-30 字/);
  assert.match(digestSrc, /没记下不等于没做成/);
  assert.match(digestSrc, /季信提到/);
  assert.match(digestSrc, /结尾不要再加「停摆」这类整年判断/);
  assert.match(digestSrc, /250 字以内/);
  assert.match(digestSrc, /350 字以内/);
  assert.match(digestSrc, /500 字以内/);
  assert.doesNotMatch(digestSrc, /必须能在信里找到依据，找不到就 ""/);
});

test('reply and digest runtime, schedule and client stay clear of the preview page', () => {
  assert.match(replyIndex, /temperature: 0\.5/);
  assert.match(replyIndex, /guardAI/);
  assert.match(replyIndex, /const due = addDays\(date, task\.dueDays\)/);
  assert.match(digestSrc, /temperature: 0\.6/);
  assert.match(digestSrc, /kind === 'week' \? 900 : kind === 'quarter' \? 220 : 90/);
  assert.match(digestSrc, /HUNYUAN_MODEL = 'hy3'/);
  assert.match(digestSrc, /HUNYUAN_FALLBACK = 'hy3-preview'/);
  assert.equal(digestConfig.timeout, 60);
  assert.equal(digestConfig.triggers[0].config, '0 0 6 * * * *');
  assert.equal(replyConfig.timeout, 60);
  assert.equal(replyConfig.triggers, undefined);
  assert.equal(app.pages.indexOf('pages/prompt-preview/prompt-preview'), -1);
  assert.equal(settings.indexOf('对比说法'), -1);
  assert.equal(fs.existsSync(path.join(root, 'promptPreview')), false);
});

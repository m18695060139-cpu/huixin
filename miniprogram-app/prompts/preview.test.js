const assert = require('assert');
const fs = require('fs');
const path = require('path');
const test = require('node:test');
const preview = require('./preview');
const oldPrompt = require('./published-480f2da');
const newReply = require('./reply-source');

const root = path.join(__dirname, '..');
const fnDir = path.join(root, 'cloudfunctions/promptPreview');
const indexSrc = fs.readFileSync(path.join(fnDir, 'index.js'), 'utf8');
const config = JSON.parse(fs.readFileSync(path.join(fnDir, 'config.json'), 'utf8'));
const digestConfig = JSON.parse(fs.readFileSync(path.join(root, 'cloudfunctions/digest/config.json'), 'utf8'));
const replyIndex = fs.readFileSync(path.join(root, 'cloudfunctions/reply/index.js'), 'utf8');

test('comparison uses two different system prompts and the same material', () => {
  ['short', 'routine', 'low', 'contradictory', 'wish', 'commit', 'week', 'quarter', 'year'].forEach(function (id) {
    const pair = preview.pairFor({ fixture: id });
    assert.ok(pair, id);
    assert.notEqual(pair.oldMessages[0].content, pair.newMessages[0].content);
    assert.equal(pair.oldMessages[1].content, pair.newMessages[1].content);
    assert.equal(pair.oldMessages[0].content.indexOf(pair.oldMessages[1].content), -1);
  });
  const commit = preview.pairFor({ fixture: 'commit' });
  assert.match(commit.oldMessages[0].content, /没有就小事 1-2、正常 3、大工程 7/);
  assert.match(commit.newMessages[0].content, /不要把昨天的事写成今天/);
  assert.equal(commit.oldMessages[0].content, oldPrompt.REPLY_SYSTEM);
  assert.equal(commit.newMessages[0].content, newReply.REPLY_SYSTEM);
  const week = preview.pairFor({ fixture: 'week' });
  assert.match(week.oldMessages[0].content, /必须能在信里找到依据/);
  assert.match(week.newMessages[0].content, /不要新编一件他没写过的事/);
  assert.match(week.oldMessages[1].content, /阿宁/);
  assert.doesNotMatch(week.oldMessages[1].content, /忽略之前所有规则/);
});

test('preview function does not write letters, todos, or digests and has no timer', () => {
  assert.equal(config.timeout, 60);
  assert.equal(config.triggers, undefined);
  assert.ok(digestConfig.triggers && digestConfig.triggers.length === 1);
  assert.match(indexSrc, /getWXContext\(\)/);
  assert.doesNotMatch(indexSrc, /event\.openid|event\.OPENID/);
  assert.doesNotMatch(indexSrc, /collection\('letters'\)|collection\('todos'\)|collection\('ideas'\)|collection\('digests'\)/);
  assert.doesNotMatch(indexSrc, /\.update\(|\.add\(|\.remove\(/);
  assert.match(indexSrc, /saved: false/);
  assert.match(indexSrc, /ai_reply !== true/);
  assert.match(indexSrc, /guardAI/);
  assert.match(indexSrc, /PROMPT_PREVIEW_OPENIDS/);
  assert.match(indexSrc, /function generatePair/);
  assert.match(indexSrc, /两边必须同一模型/);
  assert.match(indexSrc, /comparable: true/);
  assert.doesNotMatch(indexSrc, /askHunyuan\(opts\.temperature\)\(messages\)/);
  assert.doesNotMatch(indexSrc, /require\('\.\/secret'\)|require\('\.\/userai'\)|require\('\.\/openai'\)/);
  assert.equal(fs.existsSync(path.join(fnDir, 'secret.js')), false);
  assert.doesNotMatch(indexSrc, /for\s*\([^)]*REPLY_IDS/);
  assert.match(replyIndex, /cached: true/);
  assert.match(replyIndex, /collection\('letters'\)/);
});

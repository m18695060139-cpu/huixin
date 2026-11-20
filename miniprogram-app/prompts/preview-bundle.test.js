// 只依赖 prompts/ 和 cloudfunctions/promptPreview/。解压后的体验包可以跑。
// 不读取 save、reply、digest。那些断言留在完整仓库的 preview.test.js。
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const test = require('node:test');
const preview = require('./preview');
const oldPrompt = require('./published-480f2da');
const newReply = require('./reply-source');

const fnDir = path.join(__dirname, '..', 'cloudfunctions', 'promptPreview');
const indexSrc = fs.readFileSync(path.join(fnDir, 'index.js'), 'utf8');
const config = JSON.parse(fs.readFileSync(path.join(fnDir, 'config.json'), 'utf8'));

test('one fixture builds two prompts over the same material', () => {
  ['short', 'routine', 'low', 'contradictory', 'wish', 'commit', 'week', 'quarter', 'year'].forEach(function (id) {
    const pair = preview.pairFor({ fixture: id });
    assert.ok(pair, id);
    assert.equal(Array.isArray(pair), false);
    assert.notEqual(pair.oldMessages[0].content, pair.newMessages[0].content);
    assert.equal(pair.oldMessages[1].content, pair.newMessages[1].content);
  });
  const commit = preview.pairFor({ fixture: 'commit' });
  assert.equal(commit.oldMessages[0].content, oldPrompt.REPLY_SYSTEM);
  assert.equal(commit.newMessages[0].content, newReply.REPLY_SYSTEM);
  const week = preview.pairFor({ fixture: 'week' });
  assert.match(week.oldMessages[0].content, /必须能在信里找到依据/);
  assert.match(week.newMessages[0].content, /不要新编一件他没写过的事/);
});

test('preview source is one pair on one model, with no secret and no timer', () => {
  assert.equal(config.timeout, 60);
  assert.equal(config.triggers, undefined);
  assert.match(indexSrc, /function generatePair/);
  assert.match(indexSrc, /HUNYUAN_FALLBACK, temperature/);
  assert.match(indexSrc, /comparable: true/);
  assert.match(indexSrc, /getWXContext\(\)/);
  assert.match(indexSrc, /event\.action === 'whoami'/);
  const whoAt = indexSrc.indexOf("event.action === 'whoami'");
  const allowAt = indexSrc.indexOf('if (!allowed(openid))');
  const secAt = indexSrc.indexOf("event.action === 'seccheck'");
  const dbAt = indexSrc.indexOf("collection('settings')");
  assert.ok(whoAt >= 0 && allowAt > whoAt && secAt > allowAt && dbAt > secAt);
  assert.match(indexSrc, /内容安全检查暂时没连上/);
  assert.match(indexSrc, /PROMPT_PREVIEW_OPENIDS/);
  assert.match(indexSrc, /ai_reply !== true/);
  assert.match(indexSrc, /guardAI/);
  assert.match(indexSrc, /saved: false/);
  assert.doesNotMatch(indexSrc, /event\.openid|event\.OPENID/);
  assert.doesNotMatch(indexSrc, /collection\('letters'\)|collection\('todos'\)|collection\('ideas'\)|collection\('digests'\)/);
  assert.doesNotMatch(indexSrc, /\.update\(|\.add\(|\.remove\(/);
  assert.doesNotMatch(indexSrc, /require\('\.\/secret'\)|require\('\.\/userai'\)|require\('\.\/openai'\)/);
  assert.equal(fs.existsSync(path.join(fnDir, 'secret.js')), false);
  assert.doesNotMatch(indexSrc, /for\s*\([^)]*REPLY_IDS/);
});

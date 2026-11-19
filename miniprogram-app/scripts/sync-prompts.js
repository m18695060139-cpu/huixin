// 把 prompts/reply-source.js 复制进云函数目录。云函数部署包不能引用函数外面的文件。
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'prompts', 'reply-source.js');
const DEST = path.join(ROOT, 'cloudfunctions', 'reply', 'prompt-source.js');
const BANNER = [
  '// GENERATED FROM prompts/reply-source.js BY scripts/sync-prompts.js',
  '// 不要手改。改日回信提示词请编辑 prompts/reply-source.js，再运行 node scripts/sync-prompts.js。',
  '',
].join('\n');

function render() {
  return BANNER + fs.readFileSync(SRC, 'utf8');
}

function write() {
  const text = render();
  fs.writeFileSync(DEST, text);
  return text;
}

if (require.main === module) write();

module.exports = { render, write, SRC, DEST };

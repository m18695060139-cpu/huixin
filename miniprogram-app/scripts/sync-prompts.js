// 把 prompts 下的源文件复制进对应云函数目录。部署包不能引用函数外面的文件。
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const JOBS = [
  ['prompts/reply-source.js', 'cloudfunctions/reply/prompt-source.js'],
  ['prompts/digest-source.js', 'cloudfunctions/digest/prompt-source.js'],
  ['prompts/published-480f2da.js', 'cloudfunctions/promptPreview/published-480f2da.js'],
  ['prompts/reply-source.js', 'cloudfunctions/promptPreview/reply-source.js'],
  ['prompts/digest-source.js', 'cloudfunctions/promptPreview/digest-source.js'],
  ['prompts/fixtures.js', 'cloudfunctions/promptPreview/fixtures.js'],
  ['prompts/preview.js', 'cloudfunctions/promptPreview/preview.js'],
];

function banner(rel) {
  return [
    '// GENERATED FROM ' + rel + ' BY scripts/sync-prompts.js',
    '// 不要手改。改提示词请编辑 prompts 里的源文件，再运行 node scripts/sync-prompts.js。',
    '',
  ].join('\n');
}

function renderAll() {
  return JOBS.map(function (job) {
    const src = path.join(ROOT, job[0]);
    const dest = path.join(ROOT, job[1]);
    return { src: src, dest: dest, text: banner(job[0]) + fs.readFileSync(src, 'utf8') };
  });
}

function write() {
  return renderAll().map(function (item) {
    fs.writeFileSync(item.dest, item.text);
    return item.dest;
  });
}

if (require.main === module) write();

module.exports = { renderAll, write, JOBS };

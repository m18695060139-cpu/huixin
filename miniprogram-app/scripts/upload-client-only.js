// 只上传小程序代码，不部署云函数。
// 正式的 scripts/upload.js 会接着把云函数传到当前云环境。那个环境和线上共用，这次体验版不要跑它。
// 环境变量：APPID、ENV_ID、PRIVATE_KEY_PATH。版本用 VERSION，由上传的人指定，脚本不写死版本号。

const path = require('path');
const ci = require('miniprogram-ci');
const config = require('../miniprogram/config');
const projectConfig = require('../project.config.json');

function need(name) {
  const value = process.env[name];
  if (!value) {
    console.error('缺少环境变量 ' + name + '。需要 APPID、ENV_ID、PRIVATE_KEY_PATH。');
    process.exit(1);
  }
  return value;
}

async function main() {
  const appid = need('APPID');
  const envId = need('ENV_ID');
  const keyPath = need('PRIVATE_KEY_PATH');
  if (config.ENV_ID !== envId) {
    console.error('miniprogram/config.js 的 ENV_ID 是「' + config.ENV_ID + '」，和环境变量 ENV_ID 不一致。');
    process.exit(1);
  }
  if (appid !== projectConfig.appid) {
    console.error('环境变量 APPID（' + appid + '）和 project.config.json 的 appid（' + projectConfig.appid + '）不一致。');
    process.exit(1);
  }
  if (!process.env.VERSION) {
    console.error('请设置 VERSION。先在公众平台看当前最新上传版本，再选一个比它新的版本号。脚本不代填。');
    process.exit(1);
  }

  const project = new ci.Project({
    appid: appid,
    type: 'miniProgram',
    projectPath: path.resolve(__dirname, '..'),
    privateKeyPath: path.resolve(keyPath),
    ignores: ['node_modules/**/*', 'docs/**/*', 'cloudfunctions/**/*'],
  });

  const uploaded = await ci.upload({
    project: project,
    version: process.env.VERSION,
    desc: process.env.DESC || '体验版：长文滚动 + 提示词说法。云函数未更新。',
    robot: Number(process.env.ROBOT || 1),
    setting: {
      es6: true,
      es7: true,
      minify: true,
      autoPrefixWXSS: true,
      minifyWXML: true,
      minifyWXSS: true,
    },
    onProgressUpdate: function (info) {
      const msg = info && (info.message || info.status || info);
      if (msg) console.log('[代码]', typeof msg === 'string' ? msg : '');
    },
  });
  console.log('只上传了小程序代码', uploaded && (uploaded.subPackageInfo || uploaded.version || 'ok'));
  console.log('没有上传云函数。线上的 reply / digest 仍是旧提示词，要等以后单独部署才会变。');
  return uploaded;
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err && err.message ? err.message : err);
    process.exit(1);
  });
}

module.exports = { main };

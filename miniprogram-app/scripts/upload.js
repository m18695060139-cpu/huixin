// 用 miniprogram-ci 上传小程序代码，并部署云函数。
// 环境变量：APPID、ENV_ID、PRIVATE_KEY_PATH。可选 VERSION、DESC、ROBOT。
// 上传前请确认环境变量 ENV_ID 与 miniprogram/config.js 一致，APPID 与 project.config.json 一致。

const path = require('path');
const ci = require('miniprogram-ci');
const config = require('../miniprogram/config');
const projectConfig = require('../project.config.json');

const FUNCTIONS = ['login', 'save', 'importFromWeb', 'wipe'];

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
    console.error('miniprogram/config.js 的 ENV_ID 是「' + config.ENV_ID + '」，和环境变量 ENV_ID 不一致。先改 config.js 再上传，否则体验版连不上这个云环境。');
    process.exit(1);
  }
  if (appid !== projectConfig.appid) {
    console.error('环境变量 APPID（' + appid + '）和 project.config.json 的 appid（' + projectConfig.appid + '）不一致。');
    process.exit(1);
  }

  const project = new ci.Project({
    appid: appid,
    type: 'miniProgram',
    projectPath: path.resolve(__dirname, '..'),
    privateKeyPath: path.resolve(keyPath),
    ignores: ['node_modules/**/*', 'docs/**/*'],
  });

  const version = process.env.VERSION || '0.1.0';
  const desc = process.env.DESC || '回信小记体验版';
  const uploaded = await ci.upload({
    project: project,
    version: version,
    desc: desc,
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
  console.log('代码已上传', uploaded && (uploaded.subPackageInfo || uploaded.version || 'ok'));

  if (!ci.cloud || typeof ci.cloud.uploadFunction !== 'function') {
    throw new Error('当前 miniprogram-ci 没有 ci.cloud.uploadFunction，无法部署云函数');
  }
  for (let i = 0; i < FUNCTIONS.length; i++) {
    const name = FUNCTIONS[i];
    const result = await ci.cloud.uploadFunction({
      project: project,
      env: envId,
      name: name,
      path: path.resolve(__dirname, '../cloudfunctions', name),
      remoteNpmInstall: true,
    });
    console.log('云函数已上传', name, result && (result.files || result.requestId || 'ok'));
  }
  console.log('完成。请到公众平台「管理 → 版本管理」把这次上传设为体验版。体验成员在「成员管理」里添加。');
  return uploaded;
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err && err.message ? err.message : err);
    process.exit(1);
  });
}

module.exports = { main };

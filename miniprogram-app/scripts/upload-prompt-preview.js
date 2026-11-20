// 只上传名为 promptPreview 的云函数。不上传 reply、digest 或其他函数。
// 公开的 miniprogram-ci cloud.uploadFunction 不能新建函数。不存在时会 ResourceNotFound，脚本到此停止。
// 环境变量：APPID、ENV_ID、PRIVATE_KEY_PATH。

const path = require('path');
const ci = require('miniprogram-ci');
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
  if (appid !== projectConfig.appid) {
    console.error('环境变量 APPID 和 project.config.json 的 appid 不一致。');
    process.exit(1);
  }
  const project = new ci.Project({
    appid: appid,
    type: 'miniProgram',
    projectPath: path.resolve(__dirname, '..'),
    privateKeyPath: path.resolve(keyPath),
    ignores: ['node_modules/**/*'],
  });
  try {
    const result = await ci.cloud.uploadFunction({
      project: project,
      env: envId,
      name: 'promptPreview',
      path: path.resolve(__dirname, '../cloudfunctions/promptPreview'),
      remoteNpmInstall: true,
    });
    console.log('已上传 promptPreview', result && (result.files || result.requestId || 'ok'));
    console.log('请到云开发控制台确认：超时 60 秒，没有定时触发器。没有改 reply 和 digest。');
  } catch (err) {
    const msg = String(err && (err.message || err.code) || err);
    if (/ResourceNotFound/.test(msg)) {
      console.error('promptPreview 还不存在。上传密钥不能新建云函数。');
      console.error('请用已登录正式 AppID 的微信开发者工具：云开发 → 云函数 → 新建 Node.js 函数，名称 promptPreview，不要加触发器。建好后再运行本脚本。');
      process.exit(2);
    }
    throw err;
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err && err.message ? err.message : err);
    process.exit(1);
  });
}

module.exports = { main };

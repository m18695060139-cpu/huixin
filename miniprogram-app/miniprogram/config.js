// 云开发环境 ID（微信云开发控制台）。上传脚本会核对它和环境变量 ENV_ID 是否一致。
const ENV_ID = 'huixin-d1g2tdmkz68dc5a5d';

// 体验版才开混元回信。个人主体不能把 AI 功能提交审核，送审前改成 false。
const AI_ENABLED = true;

// 写信语音输入（微信同声传译 WechatSI 0.3.6，provider wx069ba97219f66d99）。
// false：app.json 不声明该插件，麦克风隐藏，上传不依赖插件授权。
// 开通后把下一行改成 true，并在 app.json 根对象恢复：
// "plugins": { "WechatSI": { "version": "0.3.6", "provider": "wx069ba97219f66d99" } }
const VOICE_ENABLED = false;

module.exports = { ENV_ID, AI_ENABLED, VOICE_ENABLED };

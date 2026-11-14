// 云开发环境 ID（微信云开发控制台）。上传脚本会核对它和环境变量 ENV_ID 是否一致。
const ENV_ID = 'huixin-d1g2tdmkz68dc5a5d';

// 这一版带不带「智能回信」。带上时用户默认关闭，要自己在「设置 → 智能回信」打开（settings.ai_reply）。
// 注意：个人主体不能申请「深度合成」类目，AI 功能大概率仍过不了审；那时改成 false 再送审。
const AI_ENABLED = true;

module.exports = { ENV_ID, AI_ENABLED };

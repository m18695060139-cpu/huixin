// 用云函数上下文里的 OPENID 识别「这是谁」。不收集昵称、头像、手机号。
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async () => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { ok: false, code: 'auth', message: '没有微信身份' };
  return { ok: true };
};

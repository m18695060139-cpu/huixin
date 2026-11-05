// 清空当前微信用户在六个集合里的全部记录。云函数有管理员权限，所以必须自己按 OPENID 过滤。
const cloud = require('wx-server-sdk');

cloud.init({ env: 'huixin-d1g2tdmkz68dc5a5d' });
const db = cloud.database();

const COLLECTIONS = ['letters', 'todos', 'ideas', 'habits', 'habit_logs', 'settings'];

async function clearColl(name, openid) {
  const coll = db.collection(name);
  for (let n = 0; n < 50; n++) {
    let res;
    try {
      res = await coll.where({ _openid: openid }).limit(100).get();
    } catch (e) {
      return;
    }
    const rows = (res && res.data) || [];
    if (!rows.length) return;
    await Promise.all(rows.map(row => coll.doc(row._id).remove()));
    if (rows.length < 100) return;
  }
}

exports.main = async () => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { ok: false, code: 'auth', message: '没有微信身份' };
  try {
    for (let i = 0; i < COLLECTIONS.length; i++) await clearColl(COLLECTIONS[i], OPENID);
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, code: 'error', message: '清空失败，请稍后再试' };
  }
};

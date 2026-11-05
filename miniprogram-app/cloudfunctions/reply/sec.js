// 和 save 云函数同一套内容安全：risky 不入库，接口故障不拦住。

const cloud = require('wx-server-sdk');

async function checkText(openid, content) {
  const text = String(content || '').trim();
  if (!text) return { suggest: 'pass' };
  let review = false;
  for (let i = 0; i < text.length; i += 2400) {
    const chunk = text.slice(i, i + 2400);
    try {
      const res = await cloud.openapi.security.msgSecCheck({
        openid: openid,
        scene: 1,
        version: 2,
        content: chunk,
      });
      const suggest = res && res.result && res.result.suggest;
      if (suggest === 'risky') return { suggest: 'risky' };
      if (suggest === 'review') review = true;
    } catch (e) {
      console.error('msgSecCheck', e && (e.errMsg || e.message || e));
      return { suggest: 'error' };
    }
  }
  return { suggest: review ? 'review' : 'pass' };
}

async function guard(openid, parts) {
  let review = false;
  for (let i = 0; i < parts.length; i++) {
    const r = await checkText(openid, parts[i]);
    if (r.suggest === 'risky') return { ok: false, code: 'risky' };
    if (r.suggest === 'review') review = true;
  }
  return { ok: true, review: review };
}

module.exports = { guard };

const cloud = require('wx-server-sdk');

async function checkText(openid, content) {
  const text = String(content || '').trim();
  if (!text || !openid) return { suggest: 'pass' };
  try {
    const res = await cloud.openapi.security.msgSecCheck({ openid: openid, scene: 1, version: 2, content: text.slice(0, 2400) });
    const suggest = res && res.result && res.result.suggest;
    if (suggest === 'risky') return { suggest: 'risky' };
    return { suggest: suggest || 'pass' };
  } catch (e) {
    console.error('msgSecCheck', e && (e.errMsg || e.message || e));
    return { suggest: 'error' };
  }
}

async function guard(openid, parts) {
  for (let i = 0; i < parts.length; i++) {
    const r = await checkText(openid, parts[i]);
    if (r.suggest === 'risky') return { ok: false };
  }
  return { ok: true };
}

module.exports = { guard };

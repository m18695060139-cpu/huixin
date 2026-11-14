// 内容安全。risky 拦住；review 放行并做标记；接口出错放行。
// 和 save / reply / importFromWeb 一样，按 2400 字分段检查，不截断后半段。

const cloud = require('wx-server-sdk');

const RISKY = '内容包含不适合保存的信息，请修改后再存';

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
      return { suggest: 'error', errCode: (e && (e.errCode || e.errcode)) || String(e && (e.errMsg || e.message) || '').replace(/[A-Za-z0-9+/=]{24,}/g, '*').slice(0, 160) || -1 };
    }
  }
  return { suggest: review ? 'review' : 'pass' };
}

async function guard(openid, parts) {
  let review = false;
  let unchecked = false;
  for (let i = 0; i < parts.length; i++) {
    const r = await checkText(openid, parts[i]);
    if (r.suggest === 'risky') return { ok: false, code: 'risky', message: RISKY };
    if (r.suggest === 'review') review = true;
    if (r.suggest === 'error') unchecked = true;
  }
  return { ok: true, review: review, unchecked: unchecked };
}

// AI 生成的内容更严：risky、review 都不展示；检查接口出错也不展示（fail-closed）。
// 各段拼成一段再按 2400 字分块查，一封回信通常只花 1 次调用（未上架小程序每天只有 100 次额度）。
async function guardAI(openid, parts) {
  const text = (parts || []).map(x => String(x || '').trim()).filter(Boolean).join('\n');
  const r = await checkText(openid, text);
  if (r.suggest !== 'pass') return { ok: false, code: r.suggest === 'error' ? 'unchecked' : 'risky', suggest: r.suggest, errCode: r.errCode || 0 };
  return { ok: true };
}

module.exports = { guard, guardAI, checkText, RISKY };

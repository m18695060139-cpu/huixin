// 体验版副本。场景和版本与对比时相同。接口出错、没有明确结论时都不算通过。
// 正式 save、reply、digest 的检查没有改。

const cloud = require('wx-server-sdk');

function publicErrCode(code) {
  if (typeof code === 'number' && Number.isFinite(code)) return code;
  if (typeof code === 'string' && /^-?\d+$/.test(code.trim())) return Number(code.trim());
  return -1;
}

function classifySec(result) {
  const suggest = result && result.suggest;
  if (suggest === 'pass') return { status: 'accepted' };
  if (suggest === 'risky') return { status: 'risky' };
  if (suggest === 'review') return { status: 'review' };
  return { status: 'unchecked', errCode: publicErrCode(result && result.errCode) };
}

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
      else if (suggest !== 'pass') {
        const code = res && (res.errCode != null ? res.errCode : res.errcode);
        return { suggest: 'error', errCode: publicErrCode(code) };
      }
    } catch (e) {
      const code = e && (e.errCode != null ? e.errCode : e.errcode);
      console.error('msgSecCheck', publicErrCode(code));
      return { suggest: 'error', errCode: publicErrCode(code) };
    }
  }
  return { suggest: review ? 'review' : 'pass' };
}

async function guard(openid, parts) {
  let review = false;
  for (let i = 0; i < parts.length; i++) {
    const r = await checkText(openid, parts[i]);
    if (r.suggest === 'risky') return { ok: false, code: 'risky', suggest: 'risky' };
    if (r.suggest === 'review') review = true;
    if (r.suggest === 'error') return { ok: false, code: 'unchecked', suggest: 'error', errCode: publicErrCode(r.errCode) };
  }
  return { ok: true, review: review };
}

// AI 生成的内容更严：risky、review 都不展示；检查接口出错也不展示（fail-closed）。
// 各段拼成一段再按 2400 字分块查，一封回信通常只花 1 次调用（未上架小程序每天只有 100 次额度）。
async function guardAI(openid, parts) {
  const text = (parts || []).map(x => String(x || '').trim()).filter(Boolean).join('\n');
  const r = await checkText(openid, text);
  if (r.suggest !== 'pass') {
    const out = { ok: false, code: r.suggest === 'error' ? 'unchecked' : 'risky', suggest: r.suggest || 'error' };
    if (out.code === 'unchecked') out.errCode = publicErrCode(r.errCode);
    return out;
  }
  return { ok: true };
}

module.exports = { guard, guardAI, checkText, classifySec, publicErrCode };

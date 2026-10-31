// 回信 · 用户 AI Key 的加密
// AES-GCM，密钥来自 Worker 的加密变量 AI_KEY_SECRET。数据库里只有密文，网页只能看到后 4 位。

async function aesKey(env) {
  if (!env.AI_KEY_SECRET) throw new Error('服务器还没配置 AI_KEY_SECRET');
  const raw = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(env.AI_KEY_SECRET));
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

export async function encryptKey(env, plain) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(env), new TextEncoder().encode(plain));
  return b64(iv) + '.' + b64(ct);
}

export async function decryptKey(env, enc) {
  const [iv, ct] = String(enc).split('.');
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, await aesKey(env), unb64(ct));
  return new TextDecoder().decode(pt);
}

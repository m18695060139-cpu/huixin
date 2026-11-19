// 用户 API Key 的加密。AES-256-GCM，格式 iv_b64.ciphertext+tag 的 b64，和网页版一样。
// 密钥来自云函数环境变量 AI_KEY_SECRET；没配就用环境 ID 派生。
// aiConfig / reply / digest 三份必须一模一样，否则存进去的 Key 解不开。
// 不要把明文 Key 打到日志里。
const crypto = require('crypto');

const ENV_ID = 'huixin-d1g2tdmkz68dc5a5d';

function rawKey() {
  const secret = process.env.AI_KEY_SECRET || ('huixin-mp-ai:' + ENV_ID);
  return crypto.createHash('sha256').update(secret).digest();
}

function encryptKey(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', rawKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return iv.toString('base64') + '.' + Buffer.concat([enc, tag]).toString('base64');
}

function decryptKey(enc) {
  const parts = String(enc || '').split('.');
  if (parts.length !== 2) throw new Error('密文格式不对');
  const iv = Buffer.from(parts[0], 'base64');
  const data = Buffer.from(parts[1], 'base64');
  if (iv.length !== 12 || data.length < 17) throw new Error('密文格式不对');
  const tag = data.slice(data.length - 16);
  const ct = data.slice(0, data.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', rawKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

module.exports = { encryptKey, decryptKey };

// 生成「新建账号」的 SQL：node scripts/create-user.mjs <账号> <密码> [名字]
// 哈希算法与 src/auth.js 一致（PBKDF2-SHA256，10 万次）
import { pbkdf2Sync, randomBytes } from 'node:crypto';

const [username, password, name = ''] = process.argv.slice(2);
if (!username || !password) {
  console.error('用法：node scripts/create-user.mjs <账号> <密码> [名字]');
  process.exit(1);
}
const salt = randomBytes(16).toString('hex');
const hash = pbkdf2Sync(password, Buffer.from(salt, 'hex'), 100000, 32, 'sha256').toString('hex');
const id = 'u' + randomBytes(6).toString('hex');
const q = s => "'" + String(s).replace(/'/g, "''") + "'";
console.log(`INSERT INTO users (id, username, pass_hash, salt, name, created_at) VALUES (${q(id)}, ${q(username)}, ${q(hash)}, ${q(salt)}, ${q(name)}, ${q(new Date().toISOString())});`);

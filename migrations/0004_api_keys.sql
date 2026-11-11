-- 只读 API 密钥：每人最多一把，只存 SHA-256，不存明文
-- Worker 第一次用到时会自己执行这句（CREATE TABLE IF NOT EXISTS），这个文件留作记录
CREATE TABLE IF NOT EXISTS api_keys (
  user_id      TEXT PRIMARY KEY,
  key_hash     TEXT NOT NULL UNIQUE,
  hint         TEXT NOT NULL,          -- 密钥开头 7 位，设置里用来认出是哪一把
  created_at   TEXT NOT NULL,
  last_used_at TEXT,
  rl_min       TEXT,                   -- 限频：当前这一分钟
  rl_n         INTEGER NOT NULL DEFAULT 0
);

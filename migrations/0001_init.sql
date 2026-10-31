-- 回信 · 数据库结构（Cloudflare D1）
-- 原则：一封信一行、一件事一行，只同步有变化的那几行

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  username    TEXT NOT NULL UNIQUE,
  pass_hash   TEXT NOT NULL,
  salt        TEXT NOT NULL,
  name        TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  expires_at  INTEGER NOT NULL
);

-- 每天一封信：你写的 text + AI 的回信 reply（JSON）
CREATE TABLE IF NOT EXISTS letters (
  user_id     TEXT NOT NULL,
  date        TEXT NOT NULL,           -- YYYY-MM-DD（北京时间）
  text        TEXT NOT NULL DEFAULT '',
  reply       TEXT,                    -- JSON：summary / answers / lenses / energy / mood ...
  energy      INTEGER,                 -- 1-5，从 reply 里冗余出来，画曲线用
  mood        TEXT,
  replied_at  TEXT,
  updated_at  TEXT NOT NULL,
  PRIMARY KEY (user_id, date)
);

CREATE TABLE IF NOT EXISTS todos (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  text        TEXT NOT NULL,
  due         TEXT,
  done        INTEGER NOT NULL DEFAULT 0,
  done_at     TEXT,
  archived    INTEGER NOT NULL DEFAULT 0,
  source_date TEXT,                    -- 从哪封信里拆出来的
  created     TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_todos_user ON todos(user_id, done, archived);

CREATE TABLE IF NOT EXISTS ideas (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  text        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'open',   -- open / todo（已转待办）/ dropped（放下了）
  source_date TEXT,
  created     TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ideas_user ON ideas(user_id, status);

CREATE TABLE IF NOT EXISTS habits (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  name        TEXT NOT NULL,
  sort        INTEGER NOT NULL DEFAULT 0,
  archived    INTEGER NOT NULL DEFAULT 0,
  created     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS habit_logs (
  user_id     TEXT NOT NULL,
  habit_id    TEXT NOT NULL,
  date        TEXT NOT NULL,
  PRIMARY KEY (habit_id, date)
);
CREATE INDEX IF NOT EXISTS idx_habit_logs_user ON habit_logs(user_id, date);

-- 周信 / 季信 / 年信
CREATE TABLE IF NOT EXISTS digests (
  user_id     TEXT NOT NULL,
  kind        TEXT NOT NULL,           -- week / quarter / year
  key         TEXT NOT NULL,           -- 2026-10-26（周一）/ 2026-Q4 / 2026
  content     TEXT NOT NULL,           -- JSON
  created_at  TEXT NOT NULL,
  PRIMARY KEY (user_id, kind, key)
);

-- 「有用 / 没用」：实验功能靠它决定去留
CREATE TABLE IF NOT EXISTS feedback (
  user_id     TEXT NOT NULL,
  date        TEXT NOT NULL,
  block       TEXT NOT NULL,
  value       INTEGER NOT NULL,        -- 1 有用 / -1 没用
  PRIMARY KEY (user_id, date, block)
);

CREATE TABLE IF NOT EXISTS settings (
  user_id     TEXT PRIMARY KEY,
  json        TEXT NOT NULL
);

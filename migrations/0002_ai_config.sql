-- 每个用户自己的 AI（OpenAI 兼容接口）。Key 加密保存。
CREATE TABLE IF NOT EXISTS ai_config (
  user_id     TEXT PRIMARY KEY,
  provider    TEXT NOT NULL,
  base_url    TEXT NOT NULL,
  model       TEXT NOT NULL,
  key_enc     TEXT NOT NULL,
  key_last4   TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

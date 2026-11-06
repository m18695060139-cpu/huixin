-- 回信 · 长期记忆
-- 每条记忆保留来源日期，便于解释、纠正和删除；所有查询必须按 user_id 隔离。
CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  content TEXT NOT NULL,
  evidence_dates TEXT NOT NULL DEFAULT '[]',
  confidence REAL NOT NULL DEFAULT 0.7,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_memories_user_status ON memories(user_id, status, updated_at DESC);

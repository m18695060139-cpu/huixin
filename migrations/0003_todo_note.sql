-- 待办的备注和「放下」：完成的、没完成的、放下的都可以写一句
-- 线上库是手动执行建表的（没有 d1_migrations 记录），这个文件已在 2026-11-03 手动执行过
ALTER TABLE todos ADD COLUMN note TEXT NOT NULL DEFAULT '';
ALTER TABLE todos ADD COLUMN dropped_at TEXT;   -- 放下的日期；NULL 表示没放下

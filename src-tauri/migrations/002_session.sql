-- 会话持久化键值表(存项目根/打开的Tab/布局状态等)
CREATE TABLE IF NOT EXISTS session (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);

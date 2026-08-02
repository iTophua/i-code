import Database from "@tauri-apps/plugin-sql";

/**
 * 会话持久化
 * 存: 当前项目根 + 打开的 Tab + 活跃 Tab + 布局状态
 * 启动时恢复, 变化时保存
 */

let dbPromise: Promise<Database> | null = null;
async function getDb(): Promise<Database> {
  if (!dbPromise) dbPromise = Database.load("sqlite:i-code.db");
  return dbPromise;
}

/** 单条键值设置 */
export async function setSession(key: string, value: unknown): Promise<void> {
  const db = await getDb();
  const json = JSON.stringify(value);
  await db.execute(
    `INSERT INTO session (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [key, json, Date.now()]
  );
}

/** 单条键值读取 */
export async function getSession<T>(key: string): Promise<T | null> {
  const db = await getDb();
  const rows = await db.select<{ value: string }[]>(
    `SELECT value FROM session WHERE key = ?`,
    [key]
  );
  if (rows.length === 0) return null;
  try {
    return JSON.parse(rows[0].value) as T;
  } catch {
    return null;
  }
}

/** 会话键名 */
export const SESSION_KEYS = {
  workspaceRoot: "workspaceRoot",
  openTabs: "openTabs",
  activeTabId: "activeTabId",
  sidebarWidth: "sidebarWidth",
  sidebarVisible: "sidebarVisible",
  sidebarView: "sidebarView",
  treeExpanded: "treeExpanded",
  treeSelected: "treeSelected",
  settingsCategory: "settingsCategory",
} as const;

/**
 * 持久化的 Tab 信息(用于重启恢复"原样")
 * - file/note: kind + path + name + preview + 草稿内容/光标
 * - 草稿(content !== null)表示有未保存修改, 恢复后保持 isDirty
 */
export interface SavedTab {
  id: string;
  kind: "file" | "note" | "diff" | "history" | "blame" | "log" | "merge" | "tool";
  path: string;
  name: string;
  language: string;
  isPreview: boolean;
  /** 草稿内容(有未保存修改时存; null = 无草稿, 从源头重读) */
  draft?: string | null;
  /** 便签标题(仅 note) */
  noteTitle?: string;
  /** 便签 id(仅 note) */
  noteId?: string;
  /** 光标位置 */
  cursor?: { line: number; column: number };
  /** 滚动位置 */
  scrollTop?: number;
}

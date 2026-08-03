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
 * 生成项目级 session key(按项目路径隔离状态, 避免跨项目串味)
 * 例: projectKey("openTabs", "/Users/x/proj-a") → "openTabs:/Users/x/proj-a"
 */
export function projectKey(base: string, projectPath: string): string {
  return `${base}:${projectPath}`;
}

/**
 * 项目级 Tab 状态(按项目隔离持久化)
 *
 * 三态语义(启动迁移逻辑据此区分):
 *  - 无 key(null)        → 首次打开该项目, 触发从旧全局 openTabs 迁移
 *  - { tabs, activeTabId } → 正常存档, 恢复这些 tab
 *  - { cleared: true }    → tombstone, 用户已关闭该项目不记忆, 跳过迁移
 */
export interface ProjectTabState {
  tabs: SavedTab[];
  activeTabId: string | null;
  /** tombstone 标记:用户关闭项目时写入, 表示"不记忆"(区别于首次无 key) */
  cleared?: boolean;
}

/** 保存某项目的文件 tab 状态 */
export async function saveProjectTabs(
  projectPath: string,
  tabs: SavedTab[],
  activeTabId: string | null
): Promise<void> {
  await setSession(projectKey(SESSION_KEYS.openTabs, projectPath), {
    tabs,
    activeTabId,
    cleared: false,
  } satisfies ProjectTabState);
}

/** 读取某项目的文件 tab 状态(返回 null = 无 key/首次; cleared=true = 已关闭不记忆) */
export async function loadProjectTabs(
  projectPath: string
): Promise<ProjectTabState | null> {
  return await getSession<ProjectTabState>(
    projectKey(SESSION_KEYS.openTabs, projectPath)
  );
}

/** 清除某项目的文件 tab 状态(写 tombstone, 关闭项目时不记忆) */
export async function clearProjectTabs(projectPath: string): Promise<void> {
  await setSession(projectKey(SESSION_KEYS.openTabs, projectPath), {
    tabs: [],
    activeTabId: null,
    cleared: true,
  } satisfies ProjectTabState);
}

/**
 * 持久化的 Tab 信息(用于重启恢复"原样")
 * - file/note: kind + path + name + preview + 草稿内容/光标
 * - 草稿(content !== null)表示有未保存修改, 恢复后保持 isDirty
 */
export interface SavedTab {
  id: string;
  kind: "file" | "note" | "diff" | "history" | "blame" | "log" | "merge" | "tool" | "image";
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

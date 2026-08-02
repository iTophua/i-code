import { create } from "zustand";

/**
 * 编辑器 Tab 状态管理
 * Tab 类型: 文件(file) 和 便签(note), 统一在主编辑区用 Tab 打开
 */

export type TabKind = "file" | "note" | "diff" | "history";

export interface EditorTab {
  /** 唯一 id(文件用路径, 便签用 note-id) */
  id: string;
  /** Tab 类型 */
  kind: TabKind;
  /** 文件绝对路径(便签为 note-id) */
  path: string;
  /** 文件名/便签标题 */
  name: string;
  /** 是否预览态(单击未双击) */
  isPreview: boolean;
  /** 是否有未保存修改 */
  isDirty: boolean;
  /** 文件内容(当前编辑中的) */
  content: string;
  /** 原始内容(用于判断 dirty) */
  originalContent: string;
  /** 语言 id(用于 Monaco 高亮) */
  language: string;
  /** 光标位置(恢复用) */
  cursor?: { line: number; column: number };
  /** 滚动位置(恢复用) */
  scrollTop?: number;
  /** 便签标题(仅 note) */
  noteTitle?: string;
  /** 便签 id(仅 note) */
  noteId?: string;
  /** diff 原始内容(仅 diff) */
  diffOriginal?: string;
}

interface EditorStore {
  tabs: EditorTab[];
  activeTabId: string | null;

  /** 打开/预览文件 */
  openFile: (file: {
    path: string;
    name: string;
    content: string;
    language: string;
    preview?: boolean;
  }) => void;
  /** 打开便签(在主编辑区以 Tab 形式) */
  openNote: (note: {
    id: string;
    title: string;
    content: string;
    language: string;
  }) => void;
  /** 打开 diff 视图 */
  openDiff: (diff: {
    id?: string;
    title: string;
    original: string;
    modified: string;
    language?: string;
  }) => void;
  /** 打开文件历史视图 */
  openHistory: (info: { filePath: string; fileName: string }) => void;
  /** 关闭 Tab */
  closeTab: (id: string) => void;
  /** 切换激活 Tab */
  setActiveTab: (id: string) => void;
  /** 更新 Tab 内容 */
  updateContent: (id: string, content: string) => void;
  /** 保存(标记为已保存) */
  markSaved: (id: string) => void;
  /** 预览转正式 */
  promotePreview: (id: string) => void;
  /** 最近关闭的 Tab 栈(供 Cmd+Shift+T 恢复) */
  recentlyClosed: EditorTab[];
  /** 恢复最近关闭的 Tab */
  reopenClosed: () => void;
  /** 判断路径是否有未保存修改(给文件树标记用) */
  isDirty: (path: string) => boolean;
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  tabs: [],
  activeTabId: null,
  recentlyClosed: [],

  openFile: ({ path, name, content, language, preview = true }) => {
    const { tabs } = get();
    // 已存在该 Tab → 激活
    const existing = tabs.find((t) => t.path === path);
    if (existing) {
      set({
        activeTabId: existing.id,
        tabs: tabs.map((t) =>
          t.id === existing.id ? { ...t, isPreview: false } : t
        ),
      });
      return;
    }

    // 预览态:替换当前预览 Tab(若有)
    const tabId = path;
    let newTabs: EditorTab[];
    if (preview) {
      const previewIdx = tabs.findIndex((t) => t.isPreview);
      const newTab: EditorTab = {
        id: tabId,
        kind: "file",
        path,
        name,
        isPreview: true,
        isDirty: false,
        content,
        originalContent: content,
        language,
      };
      if (previewIdx >= 0) {
        newTabs = [...tabs];
        newTabs[previewIdx] = newTab;
      } else {
        newTabs = [...tabs, newTab];
      }
    } else {
      newTabs = [
        ...tabs,
        {
          id: tabId,
          kind: "file" as const,
          path,
          name,
          isPreview: false,
          isDirty: false,
          content,
          originalContent: content,
          language,
        },
      ];
    }
    set({ tabs: newTabs, activeTabId: tabId });
  },

  openNote: ({ id, title, content, language }) => {
    const { tabs } = get();
    const tabId = `note:${id}`;
    // 已存在 → 激活
    const existing = tabs.find((t) => t.id === tabId);
    if (existing) {
      set({ activeTabId: tabId });
      return;
    }
    const newTab: EditorTab = {
      id: tabId,
      kind: "note",
      path: tabId,
      name: title || "无标题便签",
      isPreview: false,
      isDirty: false,
      content,
      originalContent: content,
      language,
      noteId: id,
      noteTitle: title,
    };
    set({ tabs: [...tabs, newTab], activeTabId: tabId });
  },

  openDiff: ({ id, title, original, modified, language }) => {
    const { tabs } = get();
    const tabId = id ? `diff:${id}` : `diff:${Date.now()}`;
    // 已存在则激活
    const existing = tabs.find((t) => t.id === tabId);
    if (existing) {
      // 更新内容
      set({
        activeTabId: tabId,
        tabs: tabs.map((t) =>
          t.id === tabId
            ? { ...t, content: modified, diffOriginal: original }
            : t
        ),
      });
      return;
    }
    const newTab: EditorTab = {
      id: tabId,
      kind: "diff",
      path: tabId,
      name: title,
      isPreview: false,
      isDirty: false,
      content: modified,
      originalContent: modified,
      diffOriginal: original,
      language: language || "plaintext",
    };
    set({ tabs: [...tabs, newTab], activeTabId: tabId });
  },

  openHistory: ({ filePath, fileName }) => {
    const { tabs } = get();
    const tabId = `history:${filePath}`;
    const existing = tabs.find((t) => t.id === tabId);
    if (existing) {
      set({ activeTabId: tabId });
      return;
    }
    const newTab: EditorTab = {
      id: tabId,
      kind: "history",
      path: filePath,
      name: `历史: ${fileName}`,
      isPreview: false,
      isDirty: false,
      content: "",
      originalContent: "",
      language: "plaintext",
    };
    set({ tabs: [...tabs, newTab], activeTabId: tabId });
  },

  closeTab: (id) => {
    const { tabs, activeTabId } = get();
    const idx = tabs.findIndex((t) => t.id === id);
    if (idx < 0) return;
    const closed = tabs[idx];
    const newTabs = tabs.filter((t) => t.id !== id);
    let newActive = activeTabId;
    if (activeTabId === id) {
      // 激活相邻 Tab
      const next = newTabs[idx] || newTabs[idx - 1] || null;
      newActive = next?.id ?? null;
    }
    // 压入最近关闭栈(限 20 个)
    const recentlyClosed = [closed, ...get().recentlyClosed].slice(0, 20);
    set({ tabs: newTabs, activeTabId: newActive, recentlyClosed });
  },

  setActiveTab: (id) => set({ activeTabId: id }),

  updateContent: (id, content) =>
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === id
          ? { ...t, content, isDirty: content !== t.originalContent }
          : t
      ),
    })),

  markSaved: (id) =>
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === id
          ? { ...t, isDirty: false, originalContent: t.content }
          : t
      ),
    })),

  promotePreview: (id) =>
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === id ? { ...t, isPreview: false } : t
      ),
    })),

  reopenClosed: () => {
    const { recentlyClosed, tabs } = get();
    if (recentlyClosed.length === 0) return;
    const [reopen, ...rest] = recentlyClosed;
    // 若已存在, 不重复加
    if (tabs.some((t) => t.path === reopen.path)) {
      set({ recentlyClosed: rest, activeTabId: reopen.id });
      return;
    }
    set({
      recentlyClosed: rest,
      tabs: [...tabs, { ...reopen, isPreview: false }],
      activeTabId: reopen.id,
    });
  },

  isDirty: (path) => {
    return get().tabs.some((t) => t.path === path && t.isDirty);
  },
}));

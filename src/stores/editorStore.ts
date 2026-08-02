import { create } from "zustand";
import { getLanguage } from "../utils/language";
import { noteDisplayTitle } from "./notesStore";
import { useFileTreeStore } from "./fileTreeStore";

/**
 * 编辑器 Tab 状态管理
 * Tab 类型: 文件(file) 和 便签(note), 统一在主编辑区用 Tab 打开
 */

export type TabKind = "file" | "note" | "diff" | "history" | "blame" | "log" | "merge" | "tool";

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
  /** 工具 id(仅 tool) */
  tool?: string;
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
  /** 打开 blame 视图 */
  openBlame: (info: { filePath: string; fileName: string }) => void;
  /** 打开大文件查看器 */
  openLog: (info: { filePath: string; fileName: string }) => void;
  /** 打开合并编辑器 */
  openMerge: (info: { filePath: string; fileName: string }) => void;
  /** 打开工具(在主编辑区以 Tab 形式) */
  openTool: (info: { tool: string; title: string }) => void;
  /** 关闭 Tab */
  closeTab: (id: string) => void;
  /** 关闭左侧全部 Tab */
  closeTabsToLeft: (id: string) => void;
  /** 关闭右侧全部 Tab */
  closeTabsToRight: (id: string) => void;
  /** 关闭其他 Tab */
  closeOthers: (id: string) => void;
  /** 关闭全部 Tab */
  closeAll: () => void;
  /** 切换激活 Tab */
  setActiveTab: (id: string) => void;
  /** 更新 Tab 内容 */
  updateContent: (id: string, content: string) => void;
  /** 保存(标记为已保存) */
  markSaved: (id: string) => void;
  /** 预览转正式 */
  promotePreview: (id: string) => void;
  /** 记录光标/滚动位置(供重启恢复, 节流由调用方负责) */
  recordViewport: (id: string, vp: { cursor?: { line: number; column: number }; scrollTop?: number }) => void;
  /** 恢复一个 Tab(会话恢复用, 直接构造完整状态) */
  restoreTab: (tab: EditorTab) => void;
  /** 最近关闭的 Tab 栈(供 Cmd+Shift+T 恢复) */
  recentlyClosed: EditorTab[];
  /** 恢复最近关闭的 Tab */
  reopenClosed: () => void;
  /** 判断路径是否有未保存修改(给文件树标记用) */
  isDirty: (path: string) => boolean;

  // ===== 分栏 =====
  /** 是否分栏 */
  splitEnabled: boolean;
  /** 分栏方向: horizontal(左右) | vertical(上下) */
  splitOrientation: "horizontal" | "vertical";
  /** 第二组的 tabs */
  splitTabs: EditorTab[];
  /** 第二组激活的 Tab */
  splitActiveId: string | null;
  /** 切换分栏(无方向时默认水平) */
  toggleSplit: () => void;
  /** 以指定方向开启分栏 */
  setSplitOrientation: (o: "horizontal" | "vertical") => void;
  /** 移动 Tab 到另一组 */
  moveToSplit: (id: string) => void;
  /** 从第二组移回第一组 */
  moveFromSplit: (id: string) => void;
  /** 第二组激活 */
  setSplitActive: (id: string) => void;
  /** 关闭第二组 Tab */
  closeSplitTab: (id: string) => void;
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  tabs: [],
  activeTabId: null,
  recentlyClosed: [],
  splitEnabled: false,
  splitOrientation: "horizontal",
  splitTabs: [],
  splitActiveId: null,

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
      // tab 名: 自定义标题优先, 否则取内容第一行
      name: noteDisplayTitle({ title, content }),
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

  openBlame: ({ filePath, fileName }) => {
    const { tabs } = get();
    const tabId = `blame:${filePath}`;
    const existing = tabs.find((t) => t.id === tabId);
    if (existing) {
      set({ activeTabId: tabId });
      return;
    }
    const newTab: EditorTab = {
      id: tabId,
      kind: "blame",
      path: filePath,
      name: `Blame: ${fileName}`,
      isPreview: false,
      isDirty: false,
      content: "",
      originalContent: "",
      language: getLanguage(fileName),
    };
    set({ tabs: [...tabs, newTab], activeTabId: tabId });
  },

  openLog: ({ filePath, fileName }) => {
    const { tabs } = get();
    const tabId = `log:${filePath}`;
    const existing = tabs.find((t) => t.id === tabId);
    if (existing) {
      set({ activeTabId: tabId });
      return;
    }
    const newTab: EditorTab = {
      id: tabId,
      kind: "log",
      path: filePath,
      name: fileName,
      isPreview: false,
      isDirty: false,
      content: "",
      originalContent: "",
      language: "plaintext",
    };
    set({ tabs: [...tabs, newTab], activeTabId: tabId });
  },

  openMerge: ({ filePath, fileName }) => {
    const { tabs } = get();
    const tabId = `merge:${filePath}`;
    const existing = tabs.find((t) => t.id === tabId);
    if (existing) {
      set({ activeTabId: tabId });
      return;
    }
    const newTab: EditorTab = {
      id: tabId,
      kind: "merge",
      path: filePath,
      name: `合并: ${fileName}`,
      isPreview: false,
      isDirty: false,
      content: "",
      originalContent: "",
      language: getLanguage(fileName),
    };
    set({ tabs: [...tabs, newTab], activeTabId: tabId });
  },

  openTool: ({ tool, title }) => {
    const { tabs } = get();
    const tabId = `tool:${tool}`;
    const existing = tabs.find((t) => t.id === tabId);
    if (existing) {
      set({ activeTabId: tabId });
      return;
    }
    const newTab: EditorTab = {
      id: tabId,
      kind: "tool",
      path: tabId,
      name: title,
      isPreview: false,
      isDirty: false,
      content: "",
      originalContent: "",
      language: "plaintext",
      tool,
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

  closeTabsToLeft: (id) => {
    const { tabs, activeTabId } = get();
    const idx = tabs.findIndex((t) => t.id === id);
    if (idx < 0) return;
    // 关闭的推入最近关闭栈, 预览 tab 不入栈
    const closing = tabs.slice(0, idx);
    const remaining = tabs.slice(idx);
    const recentlyClosed = [
      ...closing.filter((t) => !t.isPreview).reverse(),
      ...get().recentlyClosed,
    ].slice(0, 20);
    const newActive = remaining.some((t) => t.id === activeTabId)
      ? activeTabId
      : remaining[0]?.id ?? null;
    set({ tabs: remaining, activeTabId: newActive, recentlyClosed });
  },

  closeTabsToRight: (id) => {
    const { tabs, activeTabId } = get();
    const idx = tabs.findIndex((t) => t.id === id);
    if (idx < 0) return;
    const closing = tabs.slice(idx + 1);
    const remaining = tabs.slice(0, idx + 1);
    const recentlyClosed = [
      ...closing.filter((t) => !t.isPreview).reverse(),
      ...get().recentlyClosed,
    ].slice(0, 20);
    const newActive = remaining.some((t) => t.id === activeTabId)
      ? activeTabId
      : remaining[remaining.length - 1]?.id ?? null;
    set({ tabs: remaining, activeTabId: newActive, recentlyClosed });
  },

  closeOthers: (id) => {
    const { tabs } = get();
    const keep = tabs.find((t) => t.id === id);
    if (!keep) return;
    const closing = tabs.filter((t) => t.id !== id);
    const recentlyClosed = [
      ...closing.filter((t) => !t.isPreview).reverse(),
      ...get().recentlyClosed,
    ].slice(0, 20);
    set({ tabs: [keep], activeTabId: id, recentlyClosed });
  },

  closeAll: () => {
    const { tabs } = get();
    const recentlyClosed = [
      ...tabs.filter((t) => !t.isPreview).reverse(),
      ...get().recentlyClosed,
    ].slice(0, 20);
    set({ tabs: [], activeTabId: null, recentlyClosed });
  },

  setActiveTab: (id) => {
    set({ activeTabId: id });
    // 同步定位到文件树(自动滚动)
    const tab = get().tabs.find((t) => t.id === id);
    if (tab && tab.kind === "file") {
      const { setSelected } = useFileTreeStore.getState();
      setSelected(tab.path);
    }
  },

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

  recordViewport: (id, vp) =>
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === id
          ? {
              ...t,
              ...(vp.cursor !== undefined ? { cursor: vp.cursor } : {}),
              ...(vp.scrollTop !== undefined ? { scrollTop: vp.scrollTop } : {}),
            }
          : t
      ),
    })),

  restoreTab: (tab) => {
    const { tabs } = get();
    if (tabs.some((t) => t.id === tab.id)) return;
    set({ tabs: [...tabs, tab] });
  },

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
    const all = [...get().tabs, ...get().splitTabs];
    return all.some((t) => t.path === path && t.isDirty);
  },

  // ===== 分栏实现 =====
  toggleSplit: () =>
    set((s) => ({
      splitEnabled: !s.splitEnabled,
      // 关闭分栏时, 把第二组 Tab 移回第一组
      ...(s.splitEnabled
        ? {
            tabs: [...s.tabs, ...s.splitTabs],
            splitTabs: [],
            splitActiveId: null,
          }
        : {}),
    })),

  setSplitOrientation: (o) =>
    set(() => ({
      splitOrientation: o,
      // 切换方向时若未开启分屏则一并开启
      splitEnabled: true,
    })),

  moveToSplit: (id) => {
    const { tabs, splitTabs } = get();
    const tab = tabs.find((t) => t.id === id);
    if (!tab) return;
    set({
      tabs: tabs.filter((t) => t.id !== id),
      splitTabs: [...splitTabs, tab],
      splitActiveId: tab.id,
      splitEnabled: true,
    });
    // 修正第一组激活
    const { tabs: remaining } = get();
    if (get().activeTabId === id) {
      set({ activeTabId: remaining[remaining.length - 1]?.id ?? null });
    }
  },

  moveFromSplit: (id) => {
    const { tabs, splitTabs } = get();
    const tab = splitTabs.find((t) => t.id === id);
    if (!tab) return;
    set({
      splitTabs: splitTabs.filter((t) => t.id !== id),
      tabs: [...tabs, tab],
      activeTabId: tab.id,
    });
    // 修正第二组激活
    const { splitTabs: remaining } = get();
    if (get().splitActiveId === id) {
      set({ splitActiveId: remaining[remaining.length - 1]?.id ?? null });
    }
  },

  setSplitActive: (id) => set({ splitActiveId: id }),

  closeSplitTab: (id) => {
    const { splitTabs, splitActiveId } = get();
    const closed = splitTabs.find((t) => t.id === id);
    const newSplit = splitTabs.filter((t) => t.id !== id);
    let newActive = splitActiveId;
    if (splitActiveId === id) {
      newActive = newSplit[newSplit.length - 1]?.id ?? null;
    }
    const recentlyClosed = closed
      ? [closed, ...get().recentlyClosed].slice(0, 20)
      : get().recentlyClosed;
    set({ splitTabs: newSplit, splitActiveId: newActive, recentlyClosed });
  },
}));

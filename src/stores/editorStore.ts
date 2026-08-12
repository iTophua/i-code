import { create } from "zustand";
import { getLanguage } from "../utils/language";
import { noteDisplayTitle } from "./notesStore";
import { useFileTreeStore } from "./fileTreeStore";
import { useLayoutStore } from "./layoutStore";
import { disposeModelByPath, disposeModelsByPaths } from "../monaco/disposeModel";
import { detectIndent } from "../utils/detectIndent";
import { useSettingsStore } from "./settingsStore";

/**
 * 编辑器 Tab 状态管理
 * Tab 类型: 文件(file) 和 便签(note), 统一在主编辑区用 Tab 打开
 *
 * 内存优化: tab 关闭时主动 dispose Monaco model(否则 model + worker 镜像永久驻留)。
 *           recentlyClosed 仅存轻量元数据, 不含文件内容, reopenClosed 时从源头重读。
 */

export type TabKind = "file" | "note" | "diff" | "history" | "blame" | "log" | "merge" | "tool" | "image";

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
  /** 检测到的缩进宽度(仅 file, 打开时自动检测) */
  indentSize?: number;
  /** 检测到的缩进类型: true=空格 false=Tab(仅 file) */
  insertSpaces?: boolean;
}

/**
 * 最近关闭栈的轻量元数据(不含 content/originalContent/diffOriginal,
 * 避免 20 个关闭的文件正文常驻内存)。reopenClosed 时按 kind 重新加载内容。
 */
export interface ClosedTabMeta {
  id: string;
  kind: TabKind;
  path: string;
  name: string;
  language: string;
  noteTitle?: string;
  noteId?: string;
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
  /** 打开图片预览 */
  openImage: (info: { filePath: string; fileName: string }) => void;
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
  /**
   * 仅关闭"文件类" Tab(file/blame/history/log/image/merge/diff/tool),
   * 便签(note)是全局的不绑定项目 → 保留。
   * 用于项目切换/关闭:释放旧项目文件 Monaco model, 便签原样留在 tabs 数组。
   */
  closeAllFiles: () => void;
  /** 切换激活 Tab */
  setActiveTab: (id: string) => void;
  /** 更新 Tab 内容 */
  updateContent: (id: string, content: string) => void;
  /** 更新 Tab 缩进设置(不影响 dirty 状态) */
  updateIndent: (id: string, indent: { indentSize: number; insertSpaces: boolean }) => void;
  /** 保存(标记为已保存) */
  markSaved: (id: string) => void;
  /** 预览转正式 */
  promotePreview: (id: string) => void;
  /** 记录光标/滚动位置(供重启恢复, 节流由调用方负责) */
  recordViewport: (id: string, vp: { cursor?: { line: number; column: number }; scrollTop?: number }) => void;
  /** 恢复一个 Tab(会话恢复用, 直接构造完整状态) */
  restoreTab: (tab: EditorTab) => void;
  /** 最近关闭的 Tab 栈(供 Cmd+Shift+T 恢复, 仅元数据) */
  recentlyClosed: ClosedTabMeta[];
  /** 恢复最近关闭的 Tab(按 kind 重新加载内容) */
  reopenClosed: () => Promise<void>;
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

/** 从完整 Tab 提取轻量元数据(用于 recentlyClosed, 不含正文) */
function toClosedMeta(tab: EditorTab): ClosedTabMeta {
  return {
    id: tab.id,
    kind: tab.kind,
    path: tab.path,
    name: tab.name,
    language: tab.language,
    noteTitle: tab.noteTitle,
    noteId: tab.noteId,
    tool: tab.tool,
  };
}

/**
 * 批量构造最近关闭元数据:
 *  - 排除预览 tab(不入栈)
 *  - 排除 diff tab(内容是瞬时对比, 无法 reopenClosed 恢复 → 不入栈避免栈顶浪费)
 */
function toClosedMetas(tabs: EditorTab[]): ClosedTabMeta[] {
  return tabs
    .filter((t) => !t.isPreview && t.kind !== "diff")
    .reverse()
    .map(toClosedMeta);
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
    // 缩进自动检测(受设置开关控制)
    const detectIndentation = useSettingsStore.getState().detectIndentation;
    const indent = detectIndentation
      ? detectIndent(content, useSettingsStore.getState().tabSize)
      : undefined;
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
        indentSize: indent?.tabSize,
        insertSpaces: indent?.insertSpaces,
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
          indentSize: indent?.tabSize,
          insertSpaces: indent?.insertSpaces,
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
      // diff tab 只读, originalContent 永不参与 dirty 判断 → 用空串省一份正文拷贝
      content: modified,
      originalContent: "",
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

  openImage: ({ filePath, fileName }) => {
    const { tabs } = get();
    const tabId = `image:${filePath}`;
    const existing = tabs.find((t) => t.id === tabId);
    if (existing) {
      set({ activeTabId: tabId });
      return;
    }
    const newTab: EditorTab = {
      id: tabId,
      kind: "image",
      path: filePath,
      name: fileName,
      isPreview: false,
      isDirty: false,
      content: "",
      originalContent: "",
      language: "image",
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
    // 释放 Monaco model(避免正文 + worker 镜像常驻)
    disposeModelByPath(closed.path);
    const newTabs = tabs.filter((t) => t.id !== id);
    let newActive = activeTabId;
    if (activeTabId === id) {
      // 激活相邻 Tab
      const next = newTabs[idx] || newTabs[idx - 1] || null;
      newActive = next?.id ?? null;
    }
    // 压入最近关闭栈(限 20 个, 仅元数据不含正文; diff/预览不入栈)
    const shouldPush = !closed.isPreview && closed.kind !== "diff";
    const recentlyClosed = shouldPush
      ? [toClosedMeta(closed), ...get().recentlyClosed].slice(0, 20)
      : get().recentlyClosed;
    set({ tabs: newTabs, activeTabId: newActive, recentlyClosed });
  },

  closeTabsToLeft: (id) => {
    const { tabs, activeTabId } = get();
    const idx = tabs.findIndex((t) => t.id === id);
    if (idx < 0) return;
    const closing = tabs.slice(0, idx);
    const remaining = tabs.slice(idx);
    // 批量释放被关闭的 model
    disposeModelsByPaths(closing.map((t) => t.path));
    const recentlyClosed = [
      ...toClosedMetas(closing),
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
    disposeModelsByPaths(closing.map((t) => t.path));
    const recentlyClosed = [
      ...toClosedMetas(closing),
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
    disposeModelsByPaths(closing.map((t) => t.path));
    const recentlyClosed = [
      ...toClosedMetas(closing),
      ...get().recentlyClosed,
    ].slice(0, 20);
    set({ tabs: [keep], activeTabId: id, recentlyClosed });
  },

  closeAll: () => {
    const { tabs } = get();
    disposeModelsByPaths(tabs.map((t) => t.path));
    const recentlyClosed = [
      ...toClosedMetas(tabs),
      ...get().recentlyClosed,
    ].slice(0, 20);
    set({ tabs: [], activeTabId: null, recentlyClosed });
  },

  closeAllFiles: () => {
    const { tabs, splitTabs, activeTabId, splitActiveId } = get();
    // 主组 + 分屏组的非 note tab 都要关(便签全局保留)
    const closingMain = tabs.filter((t) => t.kind !== "note");
    const closingSplit = splitTabs.filter((t) => t.kind !== "note");
    const allClosing = [...closingMain, ...closingSplit];
    if (allClosing.length === 0) return;
    disposeModelsByPaths(allClosing.map((t) => t.path));
    const recentlyClosed = [
      ...toClosedMetas(allClosing),
      ...get().recentlyClosed,
    ].slice(0, 20);
    // 保留 note tab(主组 + 分屏组各自的便签)
    const remainingMain = tabs.filter((t) => t.kind === "note");
    const remainingSplit = splitTabs.filter((t) => t.kind === "note");
    // 激活的若是被关的文件 → 切到第一个便签(或 null)
    const newActive = remainingMain.some((t) => t.id === activeTabId)
      ? activeTabId
      : remainingMain[0]?.id ?? null;
    const newSplitActive = remainingSplit.some((t) => t.id === splitActiveId)
      ? splitActiveId
      : remainingSplit[0]?.id ?? null;
    set({
      tabs: remainingMain,
      splitTabs: remainingSplit,
      activeTabId: newActive,
      splitActiveId: newSplitActive,
      recentlyClosed,
    });
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

  updateIndent: (id, indent) =>
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === id ? { ...t, indentSize: indent.indentSize, insertSpaces: indent.insertSpaces } : t
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

  reopenClosed: async () => {
    const { recentlyClosed, tabs } = get();
    if (recentlyClosed.length === 0) return;
    const [meta, ...rest] = recentlyClosed;
    // 若已存在, 不重复加, 只激活
    if (tabs.some((t) => t.path === meta.path || t.id === meta.id)) {
      set({ recentlyClosed: rest, activeTabId: meta.id });
      return;
    }
    // 按 kind 重新加载内容(不依赖已释放的正文)
    if (meta.kind === "file") {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const [content] = await invoke<[string, string]>("read_file", { filePath: meta.path });
        set({
          recentlyClosed: rest,
          tabs: [
            ...tabs,
            {
              id: meta.id,
              kind: "file",
              path: meta.path,
              name: meta.name,
              isPreview: false,
              isDirty: false,
              content,
              originalContent: content,
              language: meta.language,
            },
          ],
          activeTabId: meta.id,
        });
      } catch (e) {
        console.error("恢复关闭的文件失败:", e);
        set({ recentlyClosed: rest });
      }
      return;
    }
    if (meta.kind === "note" && meta.noteId) {
      // 便签: 从 SQLite 重新加载(确保 notes 已加载, 否则空内容)
      const { useNotesStore } = await import("./notesStore");
      const notesState = useNotesStore.getState();
      if (notesState.notes.length === 0) {
        // notes 未加载 → 触发加载再读(避免恢复出空便签)
        await notesState.loadNotes(useLayoutStore.getState().workspaceRoot);
      }
      const note = useNotesStore.getState().notes.find((n) => n.id === meta.noteId);
      if (!note) {
        // 便签已被删除 → 弹出栈不恢复, 提示用户
        set({ recentlyClosed: rest });
        return;
      }
      const content = note.content;
      set({
        recentlyClosed: rest,
        tabs: [
          ...tabs,
          {
            id: meta.id,
            kind: "note",
            path: meta.id,
            name: noteDisplayTitle({ title: meta.noteTitle ?? "", content }),
            isPreview: false,
            isDirty: false,
            content,
            originalContent: content,
            language: meta.language,
            noteId: meta.noteId,
            noteTitle: meta.noteTitle,
          },
        ],
        activeTabId: meta.id,
      });
      return;
    }
    // 无内容类型(history/blame/log/image/diff/tool): 用对应 open 方法重新打开
    set({ recentlyClosed: rest });
    const store = get();
    const { fileName } = parseName(meta.name);
    if (meta.kind === "image") store.openImage({ filePath: meta.path, fileName });
    else if (meta.kind === "blame") store.openBlame({ filePath: meta.path, fileName });
    else if (meta.kind === "log") store.openLog({ filePath: meta.path, fileName });
    else if (meta.kind === "history") store.openHistory({ filePath: meta.path, fileName });
    else if (meta.kind === "tool" && meta.tool) store.openTool({ tool: meta.tool, title: meta.name });
    // diff 不持久化到 recentlyClosed(内容是瞬时的对比), 跳过
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
    if (closed) disposeModelByPath(closed.path);
    const newSplit = splitTabs.filter((t) => t.id !== id);
    let newActive = splitActiveId;
    if (splitActiveId === id) {
      newActive = newSplit[newSplit.length - 1]?.id ?? null;
    }
    // diff/预览不入栈
    const shouldPush = closed && !closed.isPreview && closed.kind !== "diff";
    const recentlyClosed = shouldPush
      ? [toClosedMeta(closed), ...get().recentlyClosed].slice(0, 20)
      : get().recentlyClosed;
    set({ splitTabs: newSplit, splitActiveId: newActive, recentlyClosed });
  },
}));

/** 从带前缀的 tab 名(如 "历史: foo.ts")还原文件名 */
function parseName(tabName: string): { fileName: string } {
  // 历史:/Blame:/合并: 前缀去掉
  const cleaned = tabName.replace(/^(历史: |Blame: |合并: )/, "");
  return { fileName: cleaned };
}

import { create } from "zustand";

/**
 * 工作区 UI 布局状态
 */

export type SidebarView = "explorer" | "search" | "git" | "notes" | "tools" | "settings";

/** 设置分类 */
export type SettingsCategory = "theme" | "editor" | "terminal" | "window" | "lsp";

/** Markdown 视图模式 */
export type MdViewMode = "split" | "preview" | "source";

/** 普通视图的默认侧栏宽度 */
const DEFAULT_WIDTH = 240;

interface LayoutStore {
  /** 当前侧栏视图 */
  sidebarView: SidebarView;
  /** 侧栏是否可见 */
  sidebarVisible: boolean;
  /** 侧栏宽度 */
  sidebarWidth: number;
  /** 底部面板是否可见 */
  panelVisible: boolean;
  /** 底部面板高度 */
  panelHeight: number;
  /** Markdown 视图模式: split(分屏) | preview(仅预览) | source(仅源码) */
  mdView: MdViewMode;
  /** 设置分类(设置面板激活时) */
  settingsCategory: SettingsCategory;
  /** Zen 模式(全屏无干扰) */
  zenMode: boolean;
  /** 当前项目根目录 */
  workspaceRoot: string | null;

  setSidebarView: (view: SidebarView) => void;
  toggleSidebar: () => void;
  setSidebarWidth: (w: number) => void;
  togglePanel: () => void;
  setPanelHeight: (h: number) => void;
  /** 三态循环: split → preview → source → split */
  cycleMdView: () => void;
  setMdView: (v: MdViewMode) => void;
  setSettingsCategory: (c: SettingsCategory) => void;
  toggleZen: () => void;
  setWorkspaceRoot: (root: string | null) => void;
}

export const useLayoutStore = create<LayoutStore>((set, get) => ({
  sidebarView: "explorer",
  sidebarVisible: true,
  sidebarWidth: DEFAULT_WIDTH,
  panelVisible: false,
  panelHeight: 220,
  mdView: "preview", // md 文件默认仅预览
  settingsCategory: "theme",
  zenMode: false,
  workspaceRoot: null,

  setSidebarView: (view) => {
    const { sidebarView: current, sidebarVisible } = get();
    if (current === view && sidebarVisible) {
      set({ sidebarVisible: false });
    } else {
      set({ sidebarView: view, sidebarVisible: true });
    }
  },

  toggleSidebar: () => set((s) => ({ sidebarVisible: !s.sidebarVisible })),
  setSidebarWidth: (w) => set({ sidebarWidth: w }),
  togglePanel: () => set((s) => ({ panelVisible: !s.panelVisible })),
  setPanelHeight: (h) => set({ panelHeight: h }),
  cycleMdView: () =>
    set((s) => ({
      mdView:
        s.mdView === "split" ? "preview" : s.mdView === "preview" ? "source" : "split",
    })),
  setMdView: (v) => set({ mdView: v }),
  setSettingsCategory: (c) => set({ settingsCategory: c }),
  toggleZen: () =>
    set((s) => ({
      zenMode: !s.zenMode,
      // 进入 Zen 时记住状态, 退出时恢复
      sidebarVisible: s.zenMode ? true : false,
      panelVisible: s.zenMode ? s.panelVisible : false,
    })),
  setWorkspaceRoot: (root) => set({ workspaceRoot: root }),
}));

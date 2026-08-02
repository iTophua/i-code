import { create } from "zustand";
import { getSession, setSession } from "../utils/session";

/**
 * 设置 store
 * 默认值 + 持久化(SQLite session 表) + 热更新
 */

export interface Settings {
  // —— 编辑器手感 ——
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  tabSize: number;
  wordWrap: "on" | "off";
  minimap: boolean;
  fontLigatures: boolean;
  showWhitespace: boolean;
  autoSave: "off" | "onFocusChange" | "afterDelay";

  // —— 主题 ——
  theme: "dark" | "light";

  // —— 终端 ——
  terminalFontFamily: string;
  terminalFontSize: number;
  terminalScrollback: number;

  // —— 窗口/文件 ——
  restoreOnStartup: boolean;
  showHiddenFiles: boolean;
  filesExclude: string; // 逗号分隔, 如 "node_modules,dist"

  // —— 侧栏 ——
  activityBarVisible: boolean;
  statusBarVisible: boolean;
}

const DEFAULTS: Settings = {
  fontFamily: "SF Mono, Menlo, Monaco, Consolas, monospace",
  fontSize: 14,
  lineHeight: 1.5,
  tabSize: 2,
  wordWrap: "off",
  minimap: true,
  fontLigatures: false,
  showWhitespace: false,
  autoSave: "off",

  theme: "dark",

  terminalFontFamily: "SF Mono, Menlo, Monaco, Consolas, monospace",
  terminalFontSize: 13,
  terminalScrollback: 5000,

  restoreOnStartup: true,
  showHiddenFiles: false,
  filesExclude: "node_modules, dist, .git",

  activityBarVisible: true,
  statusBarVisible: true,
};

const SESSION_KEY = "settings";

interface SettingsStore extends Settings {
  loaded: boolean;
  /** 启动时从 SQLite 加载 */
  load: () => Promise<void>;
  /** 更新单项设置(自动持久化) */
  update: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  /** 重置全部 */
  reset: () => void;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  ...DEFAULTS,
  loaded: false,

  load: async () => {
    try {
      const saved = await getSession<Partial<Settings>>(SESSION_KEY);
      if (saved) {
        set({ ...saved, loaded: true } as Partial<SettingsStore>);
      } else {
        set({ loaded: true });
      }
    } catch (e) {
      console.error("加载设置失败:", e);
      set({ loaded: true });
    }
  },

  update: (key, value) => {
    set({ [key]: value } as Partial<SettingsStore>);
    // 持久化(防抖由调用方或此处处理, 这里直接存)
    const current = { ...get() } as Settings;
    delete (current as Partial<SettingsStore>).loaded;
    delete (current as Partial<SettingsStore>).load;
    delete (current as Partial<SettingsStore>).update;
    delete (current as Partial<SettingsStore>).reset;
    setSession(SESSION_KEY, current).catch(console.error);
  },

  reset: () => {
    set({ ...DEFAULTS });
    setSession(SESSION_KEY, DEFAULTS).catch(console.error);
  },
}));

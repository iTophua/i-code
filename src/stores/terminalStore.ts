import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

/**
 * 终端多标签状态
 */

export interface TermTab {
  id: string;
  title: string;
  /** 是否已初始化 PTY */
  ready: boolean;
}

interface TerminalStore {
  tabs: TermTab[];
  activeId: string | null;

  createTerminal: (cwd: string | null) => Promise<string>;
  closeTerminal: (id: string) => void;
  setActive: (id: string) => void;
}

export const useTerminalStore = create<TerminalStore>((set, get) => ({
  tabs: [],
  activeId: null,

  createTerminal: async (cwd) => {
    const id = `term-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    // 按当前终端数命名(1, 2, 3...), 关掉再开不会跳号
    const title = `终端 ${get().tabs.length + 1}`;
    const tab: TermTab = {
      id,
      title,
      ready: false,
    };
    set((s) => ({ tabs: [...s.tabs, tab], activeId: id }));

    // 启动 PTY
    try {
      await invoke("terminal_create", {
        id,
        cwd: cwd || null,
        cols: 80,
        rows: 24,
      });
      set((s) => ({
        tabs: s.tabs.map((t) => (t.id === id ? { ...t, ready: true } : t)),
      }));
    } catch (e) {
      console.error("创建终端失败:", e);
    }
    return id;
  },

  closeTerminal: (id) => {
    invoke("terminal_kill", { id }).catch(console.error);
    set((s) => {
      const tabs = s.tabs.filter((t) => t.id !== id);
      let activeId = s.activeId;
      if (s.activeId === id) {
        activeId = tabs[tabs.length - 1]?.id ?? null;
      }
      return { tabs, activeId };
    });
  },

  setActive: (id) => set({ activeId: id }),
}));

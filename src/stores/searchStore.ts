import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

/**
 * 全局搜索状态
 */

export interface SearchHit {
  path: string;
  fileName: string;
  line: number;
  column: number;
  lineContent: string;
  matchStart: number;
  matchLen: number;
}

interface SearchStore {
  query: string;
  caseSensitive: boolean;
  isRegex: boolean;
  hits: SearchHit[];
  searching: boolean;
  done: boolean;
  total: number;
  /** 监听取消函数 */
  unlisten: UnlistenFn | null;

  setQuery: (q: string) => void;
  toggleCase: () => void;
  toggleRegex: () => void;
  runSearch: (root: string) => Promise<void>;
  clear: () => void;
}

export const useSearchStore = create<SearchStore>((set, get) => ({
  query: "",
  caseSensitive: false,
  isRegex: false,
  hits: [],
  searching: false,
  done: false,
  total: 0,
  unlisten: null,

  setQuery: (q) => set({ query: q }),
  toggleCase: () => set((s) => ({ caseSensitive: !s.caseSensitive })),
  toggleRegex: () => set((s) => ({ isRegex: !s.isRegex })),

  runSearch: async (root) => {
    const { query, unlisten } = get();
    if (!query.trim()) return;

    // 取消旧监听
    unlisten?.();
    set({ hits: [], searching: true, done: false, total: 0 });

    // 监听结果
    const fn = await listen<{
      hits: SearchHit[];
      done: boolean;
      total: number;
      query: string;
    }>("search-results", (e) => {
      // 只处理当前 query 的结果(防过期)
      if (e.payload.query !== get().query) return;
      set((s) => ({
        hits: [...s.hits, ...e.payload.hits],
        done: e.payload.done,
        total: e.payload.total,
        searching: !e.payload.done,
      }));
    });
    set({ unlisten: fn });

    try {
      await invoke("search_in_files", {
        root,
        query,
        caseSensitive: get().caseSensitive,
        isRegex: get().isRegex,
        maxResults: 2000,
      });
    } catch (e) {
      console.error("搜索失败:", e);
      set({ searching: false, done: true });
    }
  },

  clear: () => {
    const { unlisten } = get();
    unlisten?.();
    set({
      query: "",
      hits: [],
      searching: false,
      done: false,
      total: 0,
      unlisten: null,
    });
  },
}));

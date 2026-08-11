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

interface ReplaceResult {
  path: string;
  replaced: number;
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

  // 替换
  replaceText: string;
  replacing: boolean;

  setQuery: (q: string) => void;
  toggleCase: () => void;
  toggleRegex: () => void;
  runSearch: (root: string) => Promise<void>;
  setReplace: (t: string) => void;
  runReplaceAll: (root: string) => Promise<number>;
  replaceOne: (hit: SearchHit, root: string) => Promise<void>;
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

  replaceText: "",
  replacing: false,

  setQuery: (q) => set({ query: q }),
  toggleCase: () => set((s) => ({ caseSensitive: !s.caseSensitive })),
  toggleRegex: () => set((s) => ({ isRegex: !s.isRegex })),
  setReplace: (t) => set({ replaceText: t }),

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

  runReplaceAll: async (root) => {
    const { query, replaceText, caseSensitive } = get();
    if (!query.trim()) return 0;
    set({ replacing: true });
    try {
      const results = await invoke<ReplaceResult[]>("replace_in_files", {
        root,
        query,
        replacement: replaceText,
        caseSensitive,
      });
      const total = results.reduce((n, r) => n + r.replaced, 0);
      // 替换后刷新搜索结果
      await get().runSearch(root);
      return total;
    } catch (e) {
      console.error("替换失败:", e);
      throw e;
    } finally {
      set({ replacing: false });
    }
  },

  replaceOne: async (hit, root) => {
    const { replaceText } = get();
    try {
      // 读取文件内容
      const [content] = await invoke<[string, string]>("read_file", {
        filePath: hit.path,
      });
      // 按行分割, 定位到目标行
      const lines = content.split("\n");
      const targetIdx = hit.line - 1;
      if (targetIdx < 0 || targetIdx >= lines.length) return;
      const lineContent = lines[targetIdx];
      // 行内替换(按字符位, 与后端 matchStart/matchLen 的字节偏移对 ASCII 一致)
      const matchEnd = hit.matchStart + hit.matchLen;
      const newLine =
        lineContent.slice(0, hit.matchStart) +
        replaceText +
        lineContent.slice(matchEnd);
      lines[targetIdx] = newLine;
      await invoke("write_file", {
        filePath: hit.path,
        content: lines.join("\n"),
      });
      // 从 hits 中移除该条
      set((s) => ({ hits: s.hits.filter((h) => h !== hit) }));
      // 刷新搜索
      await get().runSearch(root);
    } catch (e) {
      console.error("替换单条失败:", e);
      throw e;
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

import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

/**
 * LSP 状态管理
 * 探测系统 server + 管理 monaco-languageclient
 */

export interface ServerInfo {
  language: string;
  command: string;
  installed: boolean;
  version: string | null;
}

interface LspStore {
  /** 探测结果 */
  servers: ServerInfo[];
  /** 是否已探测 */
  detected: boolean;
  /** 探测中 */
  loading: boolean;

  /** 探测所有 server */
  detect: () => Promise<void>;
}

export const useLspStore = create<LspStore>((set) => ({
  servers: [],
  detected: false,
  loading: false,

  detect: async () => {
    set({ loading: true });
    try {
      const results = await invoke<ServerInfo[]>("detect_lsp_servers");
      set({ servers: results, detected: true, loading: false });
    } catch (e) {
      console.error("LSP 探测失败:", e);
      set({ loading: false });
    }
  },
}));

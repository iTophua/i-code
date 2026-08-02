import { create } from "zustand";

/**
 * 文件剪贴板(复制/剪切/粘贴)
 */

export type ClipOp = "copy" | "cut";

interface FileClipboard {
  path: string;
  op: ClipOp;
}

interface ClipStore {
  clipboard: FileClipboard | null;

  copy: (path: string) => void;
  cut: (path: string) => void;
  clear: () => void;
}

export const useClipStore = create<ClipStore>((set) => ({
  clipboard: null,
  copy: (path) => set({ clipboard: { path, op: "copy" } }),
  cut: (path) => set({ clipboard: { path, op: "cut" } }),
  clear: () => set({ clipboard: null }),
}));

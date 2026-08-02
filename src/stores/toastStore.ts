import { create } from "zustand";

/**
 * Toast 全局提示
 */

export type ToastType = "info" | "success" | "error" | "warning";

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  /** 退场中(播放退出动画后再真正移除) */
  leaving?: boolean;
}

interface ToastStore {
  toasts: ToastItem[];
  show: (message: string, type?: ToastType) => void;
  remove: (id: string) => void;
}

let counter = 0;

const DURATION = 3500;
const EXIT_ANIM_MS = 200;

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],

  show: (message, type = "info") => {
    const id = `toast-${Date.now()}-${counter++}`;
    set((s) => ({ toasts: [...s.toasts, { id, type, message }] }));
    // 自动消失: 先标记 leaving 播退出动画, 再真正移除
    setTimeout(() => get().remove(id), DURATION);
  },

  remove: (id) => {
    // 已在退场则忽略
    if (get().toasts.find((t) => t.id === id)?.leaving) return;
    set((s) => ({
      toasts: s.toasts.map((t) => (t.id === id ? { ...t, leaving: true } : t)),
    }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, EXIT_ANIM_MS);
  },
}));

/** 便捷方法(可在非组件代码中调用) */
export const toast = {
  info: (msg: string) => useToastStore.getState().show(msg, "info"),
  success: (msg: string) => useToastStore.getState().show(msg, "success"),
  error: (msg: string) => useToastStore.getState().show(msg, "error"),
  warning: (msg: string) => useToastStore.getState().show(msg, "warning"),
};

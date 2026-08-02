import { create } from "zustand";

/**
 * Toast 全局提示
 */

export type ToastType = "info" | "success" | "error" | "warning";

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastStore {
  toasts: ToastItem[];
  show: (message: string, type?: ToastType) => void;
  remove: (id: string) => void;
}

let counter = 0;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],

  show: (message, type = "info") => {
    const id = `toast-${Date.now()}-${counter++}`;
    set((s) => ({ toasts: [...s.toasts, { id, type, message }] }));
    // 自动消失
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 3500);
  },

  remove: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** 便捷方法(可在非组件代码中调用) */
export const toast = {
  info: (msg: string) => useToastStore.getState().show(msg, "info"),
  success: (msg: string) => useToastStore.getState().show(msg, "success"),
  error: (msg: string) => useToastStore.getState().show(msg, "error"),
  warning: (msg: string) => useToastStore.getState().show(msg, "warning"),
};

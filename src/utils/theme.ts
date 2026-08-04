import { useEffect, useState } from "react";
import { useSettingsStore } from "../stores/settingsStore";

/**
 * 解析实际生效的主题("auto" → 跟随系统的 dark/light)。
 *
 * 监听两点:
 * 1. 用户设置(settings.theme)变化
 * 2. 系统主题(prefers-color-scheme)变化 — 仅 "auto" 模式下有意义
 *
 * 返回值永远是 "dark" 或 "light", 不会是 "auto"。
 */
export function useResolvedTheme(): "dark" | "light" {
  const settingsTheme = useSettingsStore((s) => s.theme);
  const [systemDark, setSystemDark] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  if (settingsTheme === "auto") return systemDark ? "dark" : "light";
  return settingsTheme;
}

/**
 * 同步获取当前实际主题(非响应式, 用于非组件场景)。
 */
export function getResolvedTheme(): "dark" | "light" {
  const settingsTheme = useSettingsStore.getState().theme;
  if (settingsTheme === "auto") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return settingsTheme;
}

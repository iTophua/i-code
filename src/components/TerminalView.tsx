import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useSettingsStore } from "../stores/settingsStore";
import { useSettingsStore as useSettings } from "../stores/settingsStore";
import "@xterm/xterm/css/xterm.css";
import "../styles/terminal.css";

/** 深色终端配色 */
const DARK_TERM = {
  background: "#1e1e1e",
  foreground: "#d4d4d4",
  cursor: "#aeafad",
  cursorAccent: "#1e1e1e",
  selectionBackground: "#264f78",
  black: "#000000", red: "#cd3131", green: "#0dbc79", yellow: "#e5e510",
  blue: "#2472c8", magenta: "#bc3fbc", cyan: "#11a8cd", white: "#e5e5e5",
  brightBlack: "#666666", brightRed: "#f14c4c", brightGreen: "#23d18b",
  brightYellow: "#f5f543", brightBlue: "#3b8eea", brightMagenta: "#d670d6",
  brightCyan: "#29b8db", brightWhite: "#ffffff",
};

/** 浅色终端配色 */
const LIGHT_TERM = {
  background: "#ffffff",
  foreground: "#333333",
  cursor: "#333333",
  cursorAccent: "#ffffff",
  selectionBackground: "#add6ff",
  black: "#000000", red: "#cd3131", green: "#00bc00", yellow: "#949800",
  blue: "#0451a5", magenta: "#bc05bc", cyan: "#0598bc", white: "#555555",
  brightBlack: "#666666", brightRed: "#cd3131", brightGreen: "#14ce14",
  brightYellow: "#b5ba00", brightBlue: "#0451a5", brightMagenta: "#bc05bc",
  brightCyan: "#0598bc", brightWhite: "#a5a5a5",
};

interface Props {
  termId: string;
  active: boolean;
}

export function TerminalView({ termId, active }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const settings = useSettingsStore();
  const theme = useSettings((s) => s.theme);

  // 主题切换时更新终端配色
  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.theme = theme === "light" ? LIGHT_TERM : DARK_TERM;
    }
  }, [theme]);

  useEffect(() => {
    if (!containerRef.current) return;

    // 创建 xterm 实例(从设置读取字体/字号/缓冲)
    const term = new Terminal({
      fontFamily: settings.terminalFontFamily,
      fontSize: settings.terminalFontSize,
      lineHeight: 1.3,
      cursorBlink: true,
      cursorStyle: "bar",
      scrollback: settings.terminalScrollback,
      theme: settings.theme === "light" ? LIGHT_TERM : DARK_TERM,
      allowProposedApi: true,
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon());
    term.open(containerRef.current);
    fit.fit();

    termRef.current = term;
    fitRef.current = fit;

    // 用户输入 → 写入 PTY
    const onData = term.onData((data) => {
      invoke("terminal_write", { id: termId, data }).catch(console.error);
    });

    // 监听后端输出
    let unlisten: UnlistenFn | null = null;
    listen<{ id: string; data: string }>("terminal-output", (e) => {
      if (e.payload.id === termId) {
        term.write(e.payload.data);
      }
    }).then((fn) => {
      unlisten = fn;
    });

    // 监听退出
    let unlistenExit: UnlistenFn | null = null;
    listen<{ id: string }>("terminal-exit", (e) => {
      if (e.payload.id === termId) {
        term.write("\r\n\x1b[90m[进程已退出]\x1b[0m\r\n");
      }
    }).then((fn) => {
      unlistenExit = fn;
    });

    // resize → 通知后端
    const onResize = term.onResize(({ cols, rows }) => {
      invoke("terminal_resize", { id: termId, cols, rows }).catch(
        console.error
      );
    });

    // 初始 fit 后上报尺寸
    const dims = fit.proposeDimensions();
    if (dims) {
      invoke("terminal_resize", {
        id: termId,
        cols: dims.cols,
        rows: dims.rows,
      }).catch(console.error);
    }

    // 容器尺寸变化时重新 fit
    const ro = new ResizeObserver(() => {
      if (active) {
        try {
          fit.fit();
        } catch {
          /* 忽略 */
        }
      }
    });
    ro.observe(containerRef.current);

    return () => {
      onData.dispose();
      onResize.dispose();
      unlisten?.();
      unlistenExit?.();
      ro.disconnect();
      term.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termId]);

  // 激活时重新 fit
  useEffect(() => {
    if (active && fitRef.current && containerRef.current) {
      // 等一帧让 DOM 布局完成
      requestAnimationFrame(() => {
        try {
          fitRef.current?.fit();
          termRef.current?.focus();
        } catch {
          /* */
        }
      });
    }
  }, [active]);

  // 终端字号/字体设置变化时, 热更新现有实例
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    term.options.fontFamily = settings.terminalFontFamily;
    term.options.fontSize = settings.terminalFontSize;
    term.options.scrollback = settings.terminalScrollback;
    // 重新 fit 适配新字号
    requestAnimationFrame(() => {
      try {
        fitRef.current?.fit();
      } catch {
        /* */
      }
    });
  }, [settings.terminalFontFamily, settings.terminalFontSize, settings.terminalScrollback]);

  return (
    <div
      className={`terminal-view ${active ? "terminal-view--active" : ""}`}
      ref={containerRef}
    />
  );
}

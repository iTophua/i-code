import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { monaco } from "./setup";

/**
 * LSP 桥接: monaco-languageclient ←→ Tauri IPC ←→ Rust LSP 进程
 * 实现一个 MessageReader/Writer 通过 Tauri 事件中转 JSON-RPC
 */

interface LspConnection {
  id: string;
  unlisten: UnlistenFn | null;
  dispose: () => void;
}

const activeConnections = new Map<string, LspConnection>();

/**
 * 为指定语言启动 LSP server 并桥接到 Monaco
 */
export async function startLspForLanguage(
  language: string,
  workspaceRoot: string,
  onMessage: (data: string) => void
): Promise<LspConnection | null> {
  const serverCommands: Record<string, { command: string; args: string[] }> = {
    go: { command: "gopls", args: ["serve"] },
    python: { command: "pyright-langserver", args: ["--stdio"] },
    rust: { command: "rust-analyzer", args: [] },
  };

  const config = serverCommands[language];
  if (!config) return null;

  const id = `lsp:${language}:${workspaceRoot}`;

  // 先停旧的
  const existing = activeConnections.get(id);
  existing?.dispose();

  // 启动 LSP 进程
  try {
    await invoke("lsp_start", {
      id,
      command: config.command,
      args: config.args,
      cwd: workspaceRoot,
    });
  } catch (e) {
    console.error(`LSP 启动失败(${language}):`, e);
    return null;
  }

  // 监听后端推送的 server stdout 消息
  let unlisten: UnlistenFn | null = null;
  unlisten = await listen<{ id: string; data: string }>("lsp-message", (e) => {
    if (e.payload.id === id) {
      onMessage(e.payload.data);
    }
  });

  const connection: LspConnection = {
    id,
    unlisten,
    dispose: () => {
      unlisten?.();
      invoke("lsp_stop", { id }).catch(console.error);
      activeConnections.delete(id);
    },
  };

  activeConnections.set(id, connection);
  return connection;
}

/**
 * 向 LSP server 发送 JSON-RPC 消息(通过 Tauri IPC)
 */
export async function sendLspMessage(id: string, message: string): Promise<void> {
  await invoke("lsp_write", { id, data: message });
}

/**
 * 停止所有 LSP 连接
 */
export function disposeAllLsp() {
  for (const conn of activeConnections.values()) {
    conn.dispose();
  }
  activeConnections.clear();
}

export { monaco };

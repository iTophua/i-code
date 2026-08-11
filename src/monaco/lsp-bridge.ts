import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import {
  createMessageConnection,
  type MessageConnection,
  type DataCallback,
  type Message,
  AbstractMessageReader,
  AbstractMessageWriter,
  type Disposable,
} from "vscode-jsonrpc";
import {
  InitializeRequest,
  InitializedNotification,
  DidOpenTextDocumentNotification,
  DidChangeTextDocumentNotification,
  DidCloseTextDocumentNotification,
  CompletionRequest,
  HoverRequest,
  PublishDiagnosticsNotification,
  type CompletionItem,
  type Hover,
  type Diagnostic,
} from "vscode-languageserver-protocol";
import { monaco } from "./setup";
import { LSP_SERVERS } from "./lsp-config";

/**
 * LSP 桥接: vscode-jsonrpc ←→ Tauri IPC ←→ Rust LSP 进程
 * 轻量方案: 不依赖 monaco-languageclient 的 services 层,
 * 手动把 diagnostics/completion/hover 注册到 Monaco API。
 */

interface LspEntry {
  id: string;
  connection: MessageConnection;
  unlisten: UnlistenFn | null;
  disposables: Disposable[];
  /** 已 didOpen 的文档 URI 集合 */
  openDocs: Set<string>;
  /** 已注册 provider 的语言(避免重复注册) */
  registeredLanguages: Set<string>;
}

const activeConnections = new Map<string, LspEntry>();
/** reader 的 onMessage 回调注册表: id → reader 实例 */
const readers = new Map<string, TauriMessageReader>();

// ============ Tauri IPC ↔ vscode-jsonrpc transport ============

class TauriMessageReader extends AbstractMessageReader {
  private callback: DataCallback | null = null;
  listen(cb: DataCallback): Disposable {
    this.callback = cb;
    return { dispose: () => { this.callback = null; } };
  }
  feed(raw: string) {
    if (!this.callback) return;
    try {
      this.callback(JSON.parse(raw) as Message);
    } catch (e) {
      this.fireError(e as Error);
    }
  }
}

class TauriMessageWriter extends AbstractMessageWriter {
  constructor(private id: string) { super(); }
  async write(msg: Message): Promise<void> {
    await invoke("lsp_write", { id: this.id, data: JSON.stringify(msg) });
  }
  end(): void { /* no-op */ }
}

// ============ 路径 ↔ URI 转换 ============

/** 文件绝对路径 → file:// URI */
function pathToUri(path: string): string {
  // 简单实现: 绝对路径转 file:// (macOS/Linux 以 / 开头, Windows X:\)
  if (/^[a-zA-Z]:/.test(path)) {
    return `file:///${path.replace(/\\/g, "/")}`;
  }
  return `file://${path}`;
}

/** Monaco model URI → 文件路径 */
// (目前未使用, 保留以备后续 definition jump 等功能)

// ============ LSP 类型 → Monaco 类型转换 ============

function lspSeverityToMonaco(severity: number): monaco.MarkerSeverity {
  switch (severity) {
    case 1: return monaco.MarkerSeverity.Error;
    case 2: return monaco.MarkerSeverity.Warning;
    case 3: return monaco.MarkerSeverity.Info;
    case 4: return monaco.MarkerSeverity.Hint;
    default: return monaco.MarkerSeverity.Error;
  }
}

function lspDiagsToMarkers(diags: Diagnostic[]): monaco.editor.IMarkerData[] {
  return diags.map((d) => ({
    severity: lspSeverityToMonaco(d.severity ?? 1),
    startLineNumber: (d.range.start.line ?? 0) + 1,
    startColumn: (d.range.start.character ?? 0) + 1,
    endLineNumber: (d.range.end.line ?? 0) + 1,
    endColumn: (d.range.end.character ?? 0) + 1,
    message: typeof d.message === "string" ? d.message : String(d.message),
    source: d.source ?? "lsp",
    code: d.code?.toString() ?? "",
  }));
}

/** LSP CompletionItem[] → Monaco languages.CompletionItem[] */
function lspCompletionsToMonaco(
  items: CompletionItem[],
  model: monaco.editor.ITextModel,
  position: monaco.Position
): monaco.languages.CompletionItem[] {
  const word = model.getWordUntilPosition(position);
  const range = {
    startLineNumber: position.lineNumber,
    endLineNumber: position.lineNumber,
    startColumn: word.startColumn,
    endColumn: word.endColumn,
  };
  return items.map((item) => ({
    label: item.label as string,
    kind: lspCompletionKindToMonaco(item.kind ?? 1),
    detail: item.detail,
    documentation: typeof item.documentation === "string"
      ? item.documentation
      : item.documentation?.value,
    insertText: (item.insertText as string) ?? (item.label as string),
    insertTextRules: item.insertTextFormat === 2
      ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
      : undefined,
    range,
  }));
}

function lspCompletionKindToMonaco(kind: number): monaco.languages.CompletionItemKind {
  // LSP CompletionItemKind 1-25, Monaco 有对应枚举但编号不完全一致
  // 映射常见值, 超出范围的默认到 Text
  const map: Record<number, monaco.languages.CompletionItemKind> = {
    1: monaco.languages.CompletionItemKind.Text,
    2: monaco.languages.CompletionItemKind.Method,
    3: monaco.languages.CompletionItemKind.Function,
    4: monaco.languages.CompletionItemKind.Constructor,
    5: monaco.languages.CompletionItemKind.Field,
    6: monaco.languages.CompletionItemKind.Variable,
    7: monaco.languages.CompletionItemKind.Class,
    8: monaco.languages.CompletionItemKind.Interface,
    9: monaco.languages.CompletionItemKind.Module,
    10: monaco.languages.CompletionItemKind.Property,
    11: monaco.languages.CompletionItemKind.Unit,
    12: monaco.languages.CompletionItemKind.Value,
    13: monaco.languages.CompletionItemKind.Enum,
    14: monaco.languages.CompletionItemKind.Keyword,
    15: monaco.languages.CompletionItemKind.Snippet,
    16: monaco.languages.CompletionItemKind.Color,
    17: monaco.languages.CompletionItemKind.File,
    18: monaco.languages.CompletionItemKind.Reference,
    19: monaco.languages.CompletionItemKind.Folder,
    20: monaco.languages.CompletionItemKind.EnumMember,
    21: monaco.languages.CompletionItemKind.Constant,
    22: monaco.languages.CompletionItemKind.Struct,
    23: monaco.languages.CompletionItemKind.Event,
    24: monaco.languages.CompletionItemKind.Operator,
    25: monaco.languages.CompletionItemKind.TypeParameter,
  };
  return map[kind] ?? monaco.languages.CompletionItemKind.Text;
}

// ============ 核心入口: ensureLsp ============

/**
 * 确保指定语言的 LSP 已启动并注册到 Monaco。
 * 幂等: 同一 language+workspaceRoot 只启动一次。
 */
export async function ensureLsp(
  language: string,
  workspaceRoot: string
): Promise<void> {
  const config = LSP_SERVERS.find((s) => s.language === language);
  if (!config) return; // 不支持的语言

  const id = `lsp:${language}:${workspaceRoot}`;
  if (activeConnections.has(id)) return; // 已启动

  await startLspInternal(id, language, workspaceRoot, config.command, config.args);
}

async function startLspInternal(
  id: string,
  language: string,
  workspaceRoot: string,
  command: string,
  args: string[]
): Promise<void> {
  // 1. 创建 reader(在 Rust 进程启动前注册, 避免 race)
  const reader = new TauriMessageReader();
  readers.set(id, reader);

  // 2. 启动 Rust LSP 进程
  try {
    await invoke("lsp_start", { id, command, args, cwd: workspaceRoot });
  } catch (e) {
    console.error(`LSP 启动失败(${language}):`, e);
    readers.delete(id);
    return;
  }

  // 3. 监听 Rust 推送的 server stdout
  const unlisten = await listen<{ id: string; data: string }>("lsp-message", (e) => {
    if (e.payload.id === id) {
      readers.get(id)?.feed(e.payload.data);
    }
  });

  // 4. 建立 JSON-RPC 连接
  const writer = new TauriMessageWriter(id);
  const connection = createMessageConnection(reader, writer);
  connection.listen();

  const entry: LspEntry = {
    id,
    connection,
    unlisten,
    disposables: [],
    openDocs: new Set(),
    registeredLanguages: new Set(),
  };

  // 5. LSP initialize 握手
  try {
    const initResult = await connection.sendRequest(InitializeRequest.method, {
      processId: null,
      rootUri: pathToUri(workspaceRoot),
      capabilities: {
        textDocument: {
          synchronization: { didOpen: true, didChange: true, didClose: true },
          completion: { completionItem: { snippetSupport: true } },
          hover: { contentFormat: ["markdown", "plaintext"] },
          publishDiagnostics: { relatedInformation: true },
        },
        workspace: { workspaceFolders: true },
      },
      workspaceFolders: [{ uri: pathToUri(workspaceRoot), name: "root" }],
    });
    void initResult;
    connection.sendNotification(InitializedNotification.method, {});
  } catch (e) {
    console.error(`LSP initialize 失败(${language}):`, e);
  }

  // 6. 注册 diagnostics 处理器
  connection.onNotification(PublishDiagnosticsNotification.type, (params) => {
    const uri = params.uri;
    const markers = lspDiagsToMarkers(params.diagnostics);
    const model = monaco.editor.getModels().find((m) => m.uri.toString() === uri);
    if (model) {
      monaco.editor.setModelMarkers(model, language, markers);
    }
  });

  // 7. 注册 completion + hover provider(每语言只注册一次)
  registerProviders(entry, language);

  activeConnections.set(id, entry);
}

function registerProviders(entry: LspEntry, language: string) {
  if (entry.registeredLanguages.has(language)) return;
  entry.registeredLanguages.add(language);

  // Completion
  entry.disposables.push(
    monaco.languages.registerCompletionItemProvider(language, {
      triggerCharacters: [".", ":", "<", '"', "'", "/", "@"],
      provideCompletionItems: async (model, position) => {
        const uri = model.uri.toString();
        const text = model.getValue();
        // 发送当前文件状态(LSP 需要最新内容)
        await notifyDidChange(entry, uri, text, language);
        try {
          const result = await entry.connection.sendRequest(CompletionRequest.method, {
            textDocument: { uri },
            position: { line: position.lineNumber - 1, character: position.column - 1 },
          });
          if (!result || !Array.isArray(result)) return { suggestions: [] };
          const items = Array.isArray(result) ? result : (result as { items: CompletionItem[] }).items;
          return { suggestions: lspCompletionsToMonaco(items, model, position) };
        } catch {
          return { suggestions: [] };
        }
      },
    })
  );

  // Hover
  entry.disposables.push(
    monaco.languages.registerHoverProvider(language, {
      provideHover: async (model, position) => {
        const uri = model.uri.toString();
        try {
          const result = await entry.connection.sendRequest(HoverRequest.method, {
            textDocument: { uri },
            position: { line: position.lineNumber - 1, character: position.column - 1 },
          }) as Hover | null;
          if (!result) return null;
          const contents = Array.isArray(result.contents) ? result.contents : [result.contents];
          const value = contents.map((c) =>
            typeof c === "string" ? c : (c as { value: string }).value
          ).join("\n\n");
          const range = result.range
            ? new monaco.Range(
                result.range.start.line + 1, result.range.start.character + 1,
                result.range.end.line + 1, result.range.end.character + 1
              )
            : new monaco.Range(
                position.lineNumber, position.column, position.lineNumber, position.column
              );
          return { contents: [{ value }], range };
        } catch {
          return null;
        }
      },
    })
  );
}

// ============ 文档同步 ============

/**
 * 通知 LSP 文档已打开/已修改。
 * 打开文件时调用,内部自动发 didOpen(首次)或 didChange(后续)。
 */
export async function syncDocument(
  language: string,
  workspaceRoot: string,
  path: string,
  content: string
): Promise<void> {
  const id = `lsp:${language}:${workspaceRoot}`;
  const entry = activeConnections.get(id);
  if (!entry) return;

  const uri = pathToUri(path);

  if (!entry.openDocs.has(uri)) {
    // 首次打开
    entry.openDocs.add(uri);
    entry.connection.sendNotification(DidOpenTextDocumentNotification.method, {
      textDocument: { uri, languageId: language, version: 1, text: content },
    });
  } else {
    // 增量变更(用全量内容, 简单可靠)
    await notifyDidChange(entry, uri, content, language);
  }
}

let changeCounter = 0;

async function notifyDidChange(
  entry: LspEntry,
  uri: string,
  content: string,
  language: string
): Promise<void> {
  if (!entry.openDocs.has(uri)) {
    // 还没 didOpen, 先 open
    entry.openDocs.add(uri);
    entry.connection.sendNotification(DidOpenTextDocumentNotification.method, {
      textDocument: { uri, languageId: language, version: 1, text: content },
    });
    return;
  }
  changeCounter++;
  entry.connection.sendNotification(DidChangeTextDocumentNotification.method, {
    textDocument: { uri, version: changeCounter },
    contentChanges: [{ text: content }],
  });
}

/**
 * 通知 LSP 文档已关闭(关闭 tab 时调用)。
 */
export function closeDocument(
  language: string,
  workspaceRoot: string,
  path: string
): void {
  const id = `lsp:${language}:${workspaceRoot}`;
  const entry = activeConnections.get(id);
  if (!entry) return;

  const uri = pathToUri(path);
  if (entry.openDocs.has(uri)) {
    entry.openDocs.delete(uri);
    entry.connection.sendNotification(DidCloseTextDocumentNotification.method, {
      textDocument: { uri },
    });
    // 清除 markers
    const model = monaco.editor.getModels().find((m) => m.uri.toString() === uri);
    if (model) monaco.editor.setModelMarkers(model, language, []);
  }
}

// ============ 清理 ============

/** 停止所有 LSP 连接(项目切换/关闭/退出时调用) */
export function disposeAllLsp() {
  for (const entry of activeConnections.values()) {
    entry.disposables.forEach((d) => d.dispose());
    entry.connection.dispose();
    entry.unlisten?.();
    invoke("lsp_stop", { id: entry.id }).catch(console.error);
  }
  activeConnections.clear();
  readers.clear();
}

export { monaco };

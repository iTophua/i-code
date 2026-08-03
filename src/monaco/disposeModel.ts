import { monaco } from "./setup";
import type { editor } from "monaco-editor";

/**
 * 释放 Monaco model(按 path 匹配)
 *
 * 背景: @monaco-editor/react 的 <Editor> 在卸载时默认不 dispose model
 * (以便切换 tab 时保留 undo 栈)。但当 tab 被真正关闭(从 store 移除)时,
 * 其 model 应立即释放, 否则文件内容 + worker 镜像(TS/CSS/JSON worker)
 * 会永久驻留, 长时间编辑会话内存只增不减。
 *
 * 匹配规则(@monaco-editor/react 用 path 作为 URI key):
 *  - 文件 tab: path = 绝对路径 → model.uri.path 命中(如 "/Users/x/a.ts")
 *  - 便签 tab: store.path = "note:id", 但 Editor 用 path={`note://${noteId}.${ext}`}
 *    → model.uri.toString() = "note://id.ext"。store 的 "note:id" 不匹配,
 *    需额外按 noteId 在 model uri 中查找
 *  - diff/tool: 用内部 model, store 的 path 不匹配, 是 no-op(无害)
 *
 * 时序安全: dispose 推迟到下一个事件循环(setTimeout 0), 确保 React 先完成
 * path 切换 → setModel 到新 model, 旧 model 已从编辑器分离, 再 dispose
 * 避免在当前挂载的 model 上 dispose 触发 ModelDisposedException。
 */
export function disposeModelByPath(path: string): void {
  if (!monaco) return;
  // 推迟到下一个事件循环: 让 React 先切换 path → setModel, 再 dispose 旧 model
  setTimeout(() => {
    if (!monaco) return;
    const models = monaco.editor.getModels();
    for (const model of models) {
      if (matchModel(model, path)) model.dispose();
    }
  }, 0);
}

/**
 * 批量释放多个 path 的 model(用于 closeAll/closeOthers 等)
 */
export function disposeModelsByPaths(paths: string[]): void {
  if (!monaco || paths.length === 0) return;
  setTimeout(() => {
    if (!monaco) return;
    const models = monaco.editor.getModels();
    for (const model of models) {
      for (const path of paths) {
        if (matchModel(model, path)) {
          model.dispose();
          break;
        }
      }
    }
  }, 0);
}

/**
 * 判断 model 是否对应给定的 store path
 *  - 文件: uri.path === path(绝对路径)
 *  - 文件: uri.toString() === path(部分场景 path 带 scheme)
 *  - 便签: store path 形如 "note:abc123", model uri 形如 "note://abc123.ts"
 *          → 按 noteId 子串匹配(去掉 "note:" 前缀后查 uri 是否含该 id)
 */
function matchModel(model: editor.ITextModel, path: string): boolean {
  const uri = model.uri;
  if (uri.path === path || uri.toString() === path) return true;
  // 便签: store.path = "note:<id>", model uri = "note://<id>.<ext>"
  if (path.startsWith("note:")) {
    const noteId = path.slice("note:".length);
    const uriStr = uri.toString();
    // 严格匹配 note://<noteId> 或 note://<noteId>.
    const prefix = `note://${noteId}`;
    return uriStr.startsWith(prefix) &&
      (uriStr.length === prefix.length || uriStr[prefix.length] === ".");
  }
  return false;
}

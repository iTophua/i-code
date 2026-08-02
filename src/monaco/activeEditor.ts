import type { editor } from "monaco-editor";

/**
 * 当前激活的 Monaco 编辑器实例持有者(模块级单例)
 *
 * 用途: 让命令面板 / 全局快捷键等编辑器外部入口能触发
 *       依赖具体编辑器实例的操作(如多光标、列选择)。
 *
 * 写入时机: 每个编辑器(EditorPane / SplitEditorPane / 便签)挂载时调用 setActive,
 *          并在获得焦点时刷新, 保证命令总是作用于"最后操作的编辑器"。
 */

let active: editor.IStandaloneCodeEditor | null = null;

export function setActiveEditor(ed: editor.IStandaloneCodeEditor | null) {
  active = ed;
}

export function getActiveEditor(): editor.IStandaloneCodeEditor | null {
  return active;
}

/**
 * 触发一个 Monaco 内置 action(按 id)
 * @returns 是否成功触发
 */
export function triggerEditorAction(actionId: string): boolean {
  const ed = getActiveEditor();
  if (!ed) return false;
  // focus 确保命令作用于该编辑器
  ed.focus();
  ed.trigger("command-palette", actionId, null);
  return true;
}

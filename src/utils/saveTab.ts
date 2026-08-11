import { invoke } from "@tauri-apps/api/core";
import { useEditorStore, type EditorTab } from "../stores/editorStore";
import { useNotesStore } from "../stores/notesStore";

/**
 * 可复用的 Tab 保存函数。
 * 文件 → 写磁盘(write_file); 便签 → 写 SQLite(updateNote)。
 * 自动保存 / 手动保存 / 关闭确认均复用此函数。
 */

/** 保存单个 Tab, 成功后 markSaved。无修改时跳过。 */
export async function saveTab(tab: EditorTab): Promise<void> {
  if (!tab.isDirty) return;
  if (tab.kind === "note" && tab.noteId) {
    await useNotesStore.getState().updateNote(tab.noteId, {
      title: tab.noteTitle ?? "",
      content: tab.content,
      language: tab.language,
    });
  } else if (tab.kind === "file") {
    await invoke("write_file", { filePath: tab.path, content: tab.content });
  }
  useEditorStore.getState().markSaved(tab.id);
}

/** 按 id 在 store 中查 tab 并保存(主组 + 分栏组都查)。 */
export async function saveTabById(id: string): Promise<void> {
  const state = useEditorStore.getState();
  const tab = state.tabs.find((t) => t.id === id) ?? state.splitTabs.find((t) => t.id === id);
  if (tab) await saveTab(tab);
}

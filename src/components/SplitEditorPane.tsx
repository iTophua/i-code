import Editor, { DiffEditor, type OnMount } from "@monaco-editor/react";
import { useEditorStore } from "../stores/editorStore";
import { useSettingsStore } from "../stores/settingsStore";
import { getEditorOptions, defineIThemes, ICODE_DARK_THEME } from "../monaco/theme";
import { setActiveEditor } from "../monaco/activeEditor";
import { setupColumnDrag } from "../monaco/columnSelect";
import "../monaco/setup";

/**
 * 第二组(分栏)的编辑器内容
 */
export function SplitEditorPane() {
  const { splitTabs, splitActiveId, updateContent } = useEditorStore();
  const settings = useSettingsStore();
  const activeTab = splitTabs.find((t) => t.id === splitActiveId);

  const handleMount: OnMount = (ed, monaco) => {
    defineIThemes(monaco);
    monaco.editor.setTheme(ICODE_DARK_THEME);
    // 多光标 modifier 用 ctrlCmd(Cmd+点击加光标), Option 让给列选(同主编辑器)
    ed.updateOptions({
      multiCursorModifier: "ctrlCmd",
      columnSelection: false,
      multiCursorPaste: "full",
    });
    // 注册为活动编辑器, 使命令面板的多光标/列选命令作用于分栏编辑器
    setActiveEditor(ed);
    ed.onDidFocusEditorText?.(() => setActiveEditor(ed));
    // Option+拖拽矩形列选(同主编辑器)
    setupColumnDrag(ed);
  };

  if (!activeTab) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-editor)" }}>
        <span style={{ color: "var(--fg-muted)", fontSize: 13 }}>分栏编辑器</span>
      </div>
    );
  }

  // 按语言覆盖
  const langOverrides: Record<string, { wordWrap?: "on" | "off" }> = {
    sql: { wordWrap: "off" },
    markdown: { wordWrap: "on" },
    json: { wordWrap: "off" },
  };
  const langOverride = langOverrides[activeTab.language] || {};

  const opts = getEditorOptions({
    fontFamily: settings.fontFamily,
    fontSize: settings.fontSize,
    lineHeight: Math.round(settings.fontSize * settings.lineHeight),
    tabSize: settings.tabSize,
    wordWrap: langOverride.wordWrap || settings.wordWrap,
    minimap: { enabled: false },
    fontLigatures: settings.fontLigatures,
    renderWhitespace: settings.showWhitespace ? "all" : "selection",
  });

  // diff Tab
  if (activeTab.kind === "diff") {
    return (
      <div className="diff-pane">
        <DiffEditor
          original={activeTab.diffOriginal ?? ""}
          modified={activeTab.content}
          language={activeTab.language}
          theme={ICODE_DARK_THEME}
          onMount={(_e, m) => { defineIThemes(m); m.editor.setTheme(ICODE_DARK_THEME); }}
          options={{ readOnly: true, renderSideBySide: true, automaticLayout: true, fontSize: 14, minimap: { enabled: false } }}
        />
      </div>
    );
  }

  return (
    <div className="editor-pane" style={{ flex: 1 }}>
      <Editor
        path={activeTab.path}
        language={activeTab.language}
        value={activeTab.content}
        onMount={handleMount}
        onChange={(v) => {
          if (splitActiveId && v !== undefined) {
            updateContent(splitActiveId, v);
          }
        }}
        options={opts}
      />
    </div>
  );
}

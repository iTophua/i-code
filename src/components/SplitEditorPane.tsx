import { useRef, useEffect } from "react";
import Editor, { DiffEditor, type OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { useEditorStore } from "../stores/editorStore";
import { useSettingsStore } from "../stores/settingsStore";
import { getEditorOptions, defineIThemes, ICODE_DARK_THEME, ICODE_LIGHT_THEME } from "../monaco/theme";
import { useResolvedTheme } from "../utils/theme";
import { setActiveEditor, getActiveEditor } from "../monaco/activeEditor";
import { setupColumnDrag } from "../monaco/columnSelect";
import { ensureLsp, syncDocument } from "../monaco/lsp-bridge";
import { useLayoutStore } from "../stores/layoutStore";
import "../monaco/setup";

/**
 * 第二组(分栏)的编辑器内容
 */
export function SplitEditorPane() {
  const { splitTabs, splitActiveId, updateContent } = useEditorStore();
  const settings = useSettingsStore();
  const theme = useResolvedTheme();
  const activeTab = splitTabs.find((t) => t.id === splitActiveId);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const cleanupColumnDragRef = useRef<(() => void) | null>(null);

  const handleMount: OnMount = (ed, monaco) => {
    editorRef.current = ed;
    defineIThemes(monaco);
    monaco.editor.setTheme(theme === "light" ? ICODE_LIGHT_THEME : ICODE_DARK_THEME);
    // 多光标 modifier 用 ctrlCmd(Cmd+点击加光标), Option 让给列选(同主编辑器)
    ed.updateOptions({
      multiCursorModifier: "alt",
      columnSelection: false,
      multiCursorPaste: "full",
    });
    // 注册为活动编辑器, 使命令面板的多光标/列选命令作用于分栏编辑器
    setActiveEditor(ed);
    ed.onDidFocusEditorText?.(() => setActiveEditor(ed));
    // Option+拖拽矩形列选(同主编辑器) —— 保存清理函数, 卸载时调用
    cleanupColumnDragRef.current?.();
    cleanupColumnDragRef.current = setupColumnDrag(ed);
    // LSP: 文件类 tab 且语言受支持时启动 LSP + 同步文档
    const wsRoot = useLayoutStore.getState().workspaceRoot;
    if (wsRoot && activeTab?.kind === "file") {
      ensureLsp(activeTab.language, wsRoot).then(() => {
        syncDocument(activeTab.language, wsRoot, activeTab.path, activeTab.content);
      }).catch(() => {});
    }
    // 应用文件检测的缩进到 model
    const model = ed.getModel();
    if (model && activeTab?.kind === "file") {
      model.updateOptions({
        tabSize: activeTab.indentSize ?? settings.tabSize,
        insertSpaces: activeTab.insertSpaces ?? true,
      });
    }
  };

  const lspChangeTimerRef = useRef<number | null>(null);

  // 切换 tab 时更新 model 的缩进
  useEffect(() => {
    const model = editorRef.current?.getModel();
    if (model && activeTab?.kind === "file") {
      model.updateOptions({
        tabSize: activeTab.indentSize ?? settings.tabSize,
        insertSpaces: activeTab.insertSpaces ?? true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splitActiveId]);

  // 卸载时清理列选拖拽监听 + 释放活动编辑器引用
  useEffect(() => {
    return () => {
      cleanupColumnDragRef.current?.();
      cleanupColumnDragRef.current = null;
      if (editorRef.current && getActiveEditor() === editorRef.current) {
        setActiveEditor(null);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    tabSize: activeTab?.indentSize ?? settings.tabSize,
    insertSpaces: activeTab?.insertSpaces ?? true,
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
          theme={theme === "light" ? ICODE_LIGHT_THEME : ICODE_DARK_THEME}
          onMount={(_e, m) => { defineIThemes(m); m.editor.setTheme(theme === "light" ? ICODE_LIGHT_THEME : ICODE_DARK_THEME); }}
          options={{
            ...getEditorOptions({ readOnly: true, fontSize: 14, minimap: { enabled: false } }),
            renderSideBySide: true,
            automaticLayout: true,
            renderOverviewRuler: false,
          }}
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
        theme={theme === "light" ? ICODE_LIGHT_THEME : ICODE_DARK_THEME}
        onMount={handleMount}
        onChange={(v) => {
          if (splitActiveId && v !== undefined) {
            updateContent(splitActiveId, v);
            // LSP didChange 同步(防抖 300ms)
            if (activeTab && activeTab.kind === "file") {
              const wsRoot = useLayoutStore.getState().workspaceRoot;
              if (wsRoot) {
                if (lspChangeTimerRef.current) clearTimeout(lspChangeTimerRef.current);
                lspChangeTimerRef.current = window.setTimeout(() => {
                  syncDocument(activeTab.language, wsRoot, activeTab.path, v);
                }, 300);
              }
            }
          }
        }}
        options={opts}
      />
    </div>
  );
}

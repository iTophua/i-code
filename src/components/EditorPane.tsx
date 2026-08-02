import { useRef, useState, useEffect } from "react";
import Editor, { DiffEditor, type OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { useEditorStore } from "../stores/editorStore";
import { useNotesStore } from "../stores/notesStore";
import { useLayoutStore } from "../stores/layoutStore";
import { useSettingsStore } from "../stores/settingsStore";
import { getEditorOptions, defineIThemes, ICODE_DARK_THEME } from "../monaco/theme";
import { saveAsFile } from "../utils/exportNote";
import { MarkdownPreview } from "./MarkdownPreview";
import { FileHistoryView } from "./FileHistoryView";
import { BlameView } from "./BlameView";
import { LogViewer } from "./LogViewer";
import { WelcomePage } from "./WelcomePage";
import "../monaco/setup"; // 启动即注册深色主题
import { NotesIcon, SaveIcon } from "./Icons";
import { AppSelect } from "./AppSelect";

const LANG_OPTIONS = [
  { value: "plaintext", label: "纯文本" },
  { value: "markdown", label: "Markdown" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "json", label: "JSON" },
  { value: "sql", label: "SQL" },
  { value: "python", label: "Python" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "shell", label: "Shell" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
];

export function EditorPane() {
  const { tabs, activeTabId, updateContent, markSaved } = useEditorStore();
  const settings = useSettingsStore();
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const activeTab = tabs.find((t) => t.id === activeTabId);

  // 从设置构建编辑器选项(响应设置变化)
  // 按语言覆盖: SQL 默认不换行, Markdown 默认换行
  const langOverrides: Record<string, { wordWrap?: "on" | "off" }> = {
    sql: { wordWrap: "off" },
    markdown: { wordWrap: "on" },
    json: { wordWrap: "off" },
  };
  const currentLang = activeTab?.language || "";
  const langOverride = langOverrides[currentLang] || {};
  const editorOpts = getEditorOptions({
    fontFamily: settings.fontFamily,
    fontSize: settings.fontSize,
    lineHeight: Math.round(settings.fontSize * settings.lineHeight),
    tabSize: settings.tabSize,
    wordWrap: langOverride.wordWrap || settings.wordWrap,
    minimap: { enabled: settings.minimap },
    fontLigatures: settings.fontLigatures,
    renderWhitespace: settings.showWhitespace ? "all" : "selection",
  });

  // 切换到 md 文件时, 默认重置为仅预览模式
  useEffect(() => {
    if (activeTab?.language === "markdown") {
      useLayoutStore.getState().setMdView("preview");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabId]);

  const handleMount: OnMount = (editorInstance, monacoInstance) => {
    editorRef.current = editorInstance;
    // 双保险: 每次挂载都确保主题已注册并应用(消除首次白色)
    defineIThemes(monacoInstance);
    monacoInstance.editor.setTheme(ICODE_DARK_THEME);
  };

  const handleChange = (value: string | undefined) => {
    if (activeTabId && value !== undefined) {
      updateContent(activeTabId, value);
      // 预览态文件一旦编辑, 自动转正(固定 Tab)
      const tab = useEditorStore.getState().tabs.find((t) => t.id === activeTabId);
      if (tab?.isPreview) {
        useEditorStore.getState().promotePreview(activeTabId);
      }
    }
  };

  const handleKeyDown = async (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "s") {
      e.preventDefault();
      await handleSave();
    }
  };

  const handleSave = async () => {
    if (!activeTab || !activeTabId) return;
    // 便签: 存到 SQLite
    if (activeTab.kind === "note" && activeTab.noteId) {
      await useNotesStore.getState().updateNote(activeTab.noteId, {
        content: activeTab.content,
      });
      markSaved(activeTabId);
      return;
    }
    // 文件: 写磁盘
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("write_file", {
        filePath: activeTab.path,
        content: activeTab.content,
      });
      markSaved(activeTabId);
    } catch (e) {
      console.error("保存失败:", e);
    }
  };

  if (!activeTab) {
    return <WelcomePage />;
  }

  // 便签 Tab
  if (activeTab.kind === "note") {
    return (
      <div className="editor-pane" onKeyDown={handleKeyDown}>
        <NoteEditorSurface
          tab={activeTab}
          onMount={handleMount}
          onChange={handleChange}
        />
      </div>
    );
  }

  // 大文件/日志 Tab
  if (activeTab.kind === "log") {
    return <LogViewer filePath={activeTab.path} fileName={activeTab.name} />;
  }

  // Blame Tab
  if (activeTab.kind === "blame") {
    return <BlameView filePath={activeTab.path} fileName={activeTab.name.replace(/^Blame:\s*/, "")} />;
  }

  // 文件历史 Tab
  if (activeTab.kind === "history") {
    return <FileHistoryView filePath={activeTab.path} fileName={activeTab.name.replace(/^历史: /, "")} />;
  }

  // Diff Tab
  if (activeTab.kind === "diff") {
    return (
      <div className="diff-pane" onKeyDown={handleKeyDown}>
        <DiffEditor
          original={activeTab.diffOriginal ?? ""}
          modified={activeTab.content}
          language={activeTab.language}
          theme={ICODE_DARK_THEME}
          onMount={(_e, monacoInstance) => {
            defineIThemes(monacoInstance);
            monacoInstance.editor.setTheme(ICODE_DARK_THEME);
          }}
          options={{
            readOnly: true,
            renderSideBySide: true,
            automaticLayout: true,
            fontSize: 14,
            fontFamily: "SF Mono, Menlo, Monaco, Consolas, monospace",
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
          }}
        />
      </div>
    );
  }

  // 文件 Tab
  const isMarkdown = activeTab.language === "markdown";

  // Markdown 文件: 并排实时预览
  if (isMarkdown) {
    return (
      <MarkdownFileEditor
        tab={activeTab}
        onMount={handleMount}
        onChange={handleChange}
        onSave={handleSave}
      />
    );
  }

  // 普通文件
  return (
    <div className="editor-pane" onKeyDown={handleKeyDown}>
      <Editor
        path={activeTab.path}
        language={activeTab.language}
        value={activeTab.content}
        onMount={handleMount}
        onChange={handleChange}
        loading={<div className="editor-loading">加载中...</div>}
        options={editorOpts}
      />
    </div>
  );
}

/**
 * Markdown 文件编辑器: 源码 + 并排实时预览
 */
function MarkdownFileEditor({
  tab,
  onMount,
  onChange,
}: {
  tab: import("../stores/editorStore").EditorTab;
  onMount: OnMount;
  onChange: (v: string | undefined) => void;
  onSave: () => Promise<void>;
}) {
  const { mdView } = useLayoutStore();
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const [scrollRatio, setScrollRatio] = useState<number | undefined>(undefined);

  // 挂载时接管 onMount, 监听编辑器滚动
  const handleMdMount: OnMount = (ed, monaco) => {
    editorRef.current = ed;
    // 同步滚动: 编辑器滚动 → 算比例 → 传给预览
    ed.onDidScrollChange(() => {
      const top = ed.getScrollTop();
      const max = ed.getScrollHeight() - ed.getLayoutInfo().height;
      setScrollRatio(max > 0 ? top / max : 0);
    });
    onMount(ed, monaco);
  };

  // 预览反向滚动 → 编辑器跟随
  const handlePreviewScroll = (ratio: number) => {
    const ed = editorRef.current;
    if (!ed) return;
    const max = ed.getScrollHeight() - ed.getLayoutInfo().height;
    ed.setScrollTop(max * ratio);
  };

  return (
    <div className="editor-pane md-pane" onKeyDown={(e) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "v") {
        e.preventDefault();
        useLayoutStore.getState().cycleMdView();
      }
    }}>
      <div className={`md-split md-split--${mdView}`}>
        <div
          className="md-split__editor"
          style={mdView === "preview" ? { display: "none" } : undefined}
        >
          <Editor
            path={tab.path}
            language="markdown"
            value={tab.content}
            onMount={handleMdMount}
            onChange={onChange}
            loading={<div className="editor-loading">加载中...</div>}
            options={getEditorOptions({
              wordWrap: "on",
              fontSize: 14,
              padding: { top: 0, bottom: 8 },
            })}
          />
        </div>
        <div
          className="md-preview-wrap"
          onDoubleClick={
            mdView === "preview"
              ? () => useLayoutStore.getState().setMdView("split")
              : undefined
          }
          title={mdView === "preview" ? "双击进入编辑" : undefined}
          style={mdView === "source" ? { display: "none" } : undefined}
        >
          <MarkdownPreview
            content={tab.content}
            scrollRatio={scrollRatio}
            onScroll={handlePreviewScroll}
          />
        </div>
      </div>
    </div>
  );
}

/** 便签编辑界面: 顶部标题栏 + Monaco 内容区 */
function NoteEditorSurface({
  tab,
  onMount,
  onChange,
}: {
  tab: import("../stores/editorStore").EditorTab;
  onMount: OnMount;
  onChange: (v: string | undefined) => void;
}) {
  const updateNote = useNotesStore((s) => s.updateNote);
  const titleTimer = useRef<number | null>(null);
  const contentTimer = useRef<number | null>(null);
  const [savedHint, setSavedHint] = useState<string | null>(null);

  // 另存为文件
  const handleSaveAs = async () => {
    try {
      const path = await saveAsFile(
        tab.noteTitle || "untitled",
        tab.language,
        tab.content
      );
      if (path) {
        const name = path.split("/").pop() || path;
        setSavedHint(`已导出: ${name}`);
        setTimeout(() => setSavedHint(null), 2500);
      }
    } catch (e) {
      setSavedHint(`导出失败: ${e}`);
      setTimeout(() => setSavedHint(null), 3000);
    }
  };

  // 标题防抖保存
  const onTitleChange = (title: string) => {
    // 立即更新本地 Tab 显示
    useEditorStore.setState((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === tab.id ? { ...t, name: title || "无标题便签", noteTitle: title } : t
      ),
    }));
    if (titleTimer.current) clearTimeout(titleTimer.current);
    titleTimer.current = window.setTimeout(() => {
      if (tab.noteId) updateNote(tab.noteId, { title });
    }, 500);
  };

  // 内容防抖保存
  const onContentChange = (v: string | undefined) => {
    onChange(v);
    if (contentTimer.current) clearTimeout(contentTimer.current);
    contentTimer.current = window.setTimeout(() => {
      if (tab.noteId) updateNote(tab.noteId!, { content: v ?? "" });
    }, 800);
  };

  // 语言切换
  const onLangChange = (language: string) => {
    useEditorStore.setState((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === tab.id ? { ...t, language } : t
      ),
    }));
    if (tab.noteId) updateNote(tab.noteId, { language });
  };

  return (
    <div className="note-surface">
      <div className="note-surface__toolbar">
        <span className="note-surface__icon">
          <NotesIcon size={16} />
        </span>
        <input
          className="note-surface__title"
          value={tab.noteTitle ?? ""}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="便签标题..."
        />
        <AppSelect
          value={tab.language}
          options={LANG_OPTIONS}
          onChange={onLangChange}
          title="语法高亮语言"
        />
        <button
          className="note-surface__btn"
          onClick={handleSaveAs}
          title="另存为文件"
        >
          <SaveIcon size={15} />
        </button>
        {savedHint && <span className="note-surface__hint">{savedHint}</span>}
      </div>
      <div className="note-surface__body">
        <Editor
          height="100%"
          language={tab.language}
          value={tab.content}
          onMount={onMount}
          onChange={onContentChange}
          options={getEditorOptions({
            wordWrap: "on",
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: "on",
            folding: false,
            lineDecorationsWidth: 8,
            lineNumbersMinChars: 3,
            scrollBeyondLastLine: false,
            padding: { top: 12, bottom: 12 },
          })}
        />
      </div>
    </div>
  );
}

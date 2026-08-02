import { useRef, useState, useEffect, useMemo } from "react";
import Editor, { DiffEditor, type OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { useEditorStore } from "../stores/editorStore";
import { useNotesStore, noteDisplayTitle } from "../stores/notesStore";
import { useLayoutStore } from "../stores/layoutStore";
import { useSettingsStore } from "../stores/settingsStore";
import { useGitStore } from "../stores/gitStore";
import { getEditorOptions, defineIThemes, ICODE_DARK_THEME } from "../monaco/theme";
import { saveAsFile } from "../utils/exportNote";
import { MarkdownPreview } from "./MarkdownPreview";
import { FileHistoryView } from "./FileHistoryView";
import { BlameView } from "./BlameView";
import { LogViewer } from "./LogViewer";
import { WelcomePage } from "./WelcomePage";
import { MergeEditor } from "./MergeEditor";
import "../monaco/setup"; // 启动即注册深色主题
import { NotesIcon, SaveIcon } from "./Icons";
import { AppSelect } from "./AppSelect";
import { ToolSurface } from "./ToolSurface";
import { NoteQuickTools } from "./NoteQuickTools";
import { format as sqlFormat } from "sql-formatter";
import { toast } from "../stores/toastStore";
import { getExtByLanguage } from "../utils/language";
import { setActiveEditor, triggerEditorAction } from "../monaco/activeEditor";
import { setupColumnDrag } from "../monaco/columnSelect";
import { tabInScope } from "../utils/tabScope";
import { EditorContextMenu } from "./EditorContextMenu";

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
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  // 与分支比较: 选择目标分支
  const [compareTarget, setCompareTarget] = useState<{ filePath: string; fileName: string } | null>(null);
  // 行内 Blame 显示开关 + 装饰引用
  const [showBlame, setShowBlame] = useState(false);
  const blameDecorationsRef = useRef<string[]>([]);
  // 精确订阅设置项(避免无关 state 变化触发重渲染)
  const fontFamily = useSettingsStore((s) => s.fontFamily);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const lineHeight = useSettingsStore((s) => s.lineHeight);
  const tabSize = useSettingsStore((s) => s.tabSize);
  const wordWrap = useSettingsStore((s) => s.wordWrap);
  const minimap = useSettingsStore((s) => s.minimap);
  const fontLigatures = useSettingsStore((s) => s.fontLigatures);
  const showWhitespace = useSettingsStore((s) => s.showWhitespace);
  // 按当前侧栏菜单域过滤: activeTab 不在域内时, 取域内第一个(或显示空白页)
  const sidebarView = useLayoutStore((s) => s.sidebarView);
  const scopedTabs = tabs.filter((t) => tabInScope(t.kind, sidebarView));
  const activeTab = scopedTabs.find((t) => t.id === activeTabId)
    ?? scopedTabs[0];

  // 按语言覆盖: SQL 默认不换行, Markdown 默认换行
  const langOverrides: Record<string, { wordWrap?: "on" | "off" }> = {
    sql: { wordWrap: "off" },
    markdown: { wordWrap: "on" },
    json: { wordWrap: "off" },
  };
  const currentLang = activeTab?.language || "";
  const langOverride = langOverrides[currentLang] || {};
  // 缓存编辑器选项(只在依赖项变化时重建, 避免每次渲染新建对象触发 Monaco 更新)
  const editorOpts = useMemo(
    () =>
      getEditorOptions({
        fontFamily,
        fontSize,
        lineHeight: Math.round(fontSize * lineHeight),
        tabSize,
        wordWrap: langOverride.wordWrap || wordWrap,
        minimap: { enabled: minimap },
        fontLigatures,
        renderWhitespace: showWhitespace ? "all" : "selection",
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fontFamily, fontSize, lineHeight, tabSize, wordWrap, minimap, fontLigatures, showWhitespace, currentLang]
  );

  // 切换到 md 文件时, 默认重置为仅预览模式
  useEffect(() => {
    if (activeTab?.language === "markdown") {
      useLayoutStore.getState().setMdView("preview");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabId]);

  // 菜单域切换: 若当前激活 tab 不在新域内, 自动激活该域第一个 tab(或清除)
  useEffect(() => {
    const store = useEditorStore.getState();
    const inScope = store.tabs.some(
      (t) => t.id === store.activeTabId && tabInScope(t.kind, sidebarView)
    );
    if (!inScope) {
      const first = scopedTabs[0];
      store.setActiveTab(first ? first.id : (store.activeTabId ?? ""));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sidebarView, scopedTabs.length]);

  const handleMount: OnMount = (editorInstance, monacoInstance) => {
    editorRef.current = editorInstance;
    // 双保险: 每次挂载都确保主题已注册并应用(消除首次白色)
    defineIThemes(monacoInstance);
    monacoInstance.editor.setTheme(ICODE_DARK_THEME);
    // 多光标 modifier 用 ctrlCmd: Cmd+点击加光标, 把 Option 键让给列选(见 setupColumnDrag),
    // 避免两者在 Alt+mousedown 上冲突(Monaco 默认 alt 会抢先加光标)
    editorInstance.updateOptions({
      multiCursorModifier: "alt",
      columnSelection: false,
      multiCursorPaste: "full",
    });
    // 注册为活动编辑器(聚焦时刷新), 供命令面板等外部入口触发多光标/列选等
    setActiveEditor(editorInstance);
    editorInstance.onDidFocusEditorText?.(() => setActiveEditor(editorInstance));

    // Option(Alt)+左键拖拽 → 矩形列选(standalone Monaco 不内置, 手动实现)
    setupColumnDrag(editorInstance);

    // 恢复光标/滚动位置(重启恢复 tab 原样)
    if (activeTab?.cursor) {
      editorInstance.setPosition({
        lineNumber: activeTab.cursor.line,
        column: activeTab.cursor.column,
      });
      editorInstance.revealPositionInCenterIfOutsideViewport({
        lineNumber: activeTab.cursor.line,
        column: activeTab.cursor.column,
      });
    }
    if (activeTab?.scrollTop) {
      editorInstance.setScrollTop(activeTab.scrollTop);
    }

    // (右键菜单已禁用 Monaco 默认英文菜单, 改用 EditorContextMenu 自定义中文菜单)

    // 记录光标位置(节流, 供重启恢复)
    let cursorTimer: number | null = null;
    editorInstance.onDidChangeCursorPosition((e) => {
      if (cursorTimer) clearTimeout(cursorTimer);
      cursorTimer = window.setTimeout(() => {
        if (activeTabId) {
          useEditorStore.getState().recordViewport(activeTabId, {
            cursor: { line: e.position.lineNumber, column: e.position.column },
          });
        }
      }, 400);
    });
    // 记录滚动位置(节流)
    let scrollTimer: number | null = null;
    editorInstance.onDidScrollChange((e) => {
      if (!e.scrollTopChanged) return;
      if (scrollTimer) clearTimeout(scrollTimer);
      scrollTimer = window.setTimeout(() => {
        if (activeTabId) {
          useEditorStore.getState().recordViewport(activeTabId, {
            scrollTop: editorInstance.getScrollTop(),
          });
        }
      }, 400);
    });
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
    // 便签: 标题/内容/语言 提交到 SQLite
    if (activeTab.kind === "note" && activeTab.noteId) {
      await useNotesStore.getState().updateNote(activeTab.noteId, {
        title: activeTab.noteTitle ?? "",
        content: activeTab.content,
        language: activeTab.language,
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

  // 工具 Tab
  if (activeTab.kind === "tool") {
    return <ToolSurface tool={activeTab.tool ?? ""} title={activeTab.name} />;
  }

  // 合并编辑器 Tab
  if (activeTab.kind === "merge") {
    return <MergeEditor filePath={activeTab.path} fileName={activeTab.name.replace(/^合并:\s*/, "")} />;
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
  const ed = editorRef.current;

  // 行内 Blame: 切换显示/隐藏
  const toggleBlame = async () => {
    // 实时从 ref 取编辑器实例(避免闭包旧值)
    const ed = editorRef.current;
    const tab = useEditorStore.getState().tabs.find((t) => t.id === activeTabId);
    if (!ed || !tab) {
      toast.warning("编辑器未就绪");
      return;
    }
    const { repoRoot } = useGitStore.getState();
    if (!repoRoot) {
      toast.warning("非 Git 仓库");
      return;
    }
    if (showBlame) {
      ed.deltaDecorations(blameDecorationsRef.current, []);
      blameDecorationsRef.current = [];
      setShowBlame(false);
      return;
    }
    try {
      const rel = tab.path.replace(repoRoot + "/", "");
      const out = await useGitStore.getState().blameFile(rel);
      const blameMap = parseBlameInline(out);
      if (blameMap.size === 0) {
        toast.warning("未获取到 Blame 数据");
        return;
      }
      const decos: editor.IModelDeltaDecoration[] = [];
      for (const [line, info] of blameMap) {
        decos.push({
          range: { startLineNumber: line, startColumn: 1, endLineNumber: line, endColumn: 1 },
          options: {
            after: { content: `   ${info.author} · ${info.time}`, inlineClassName: "blame-decoration" },
            isWholeLine: true,
          },
        });
      }
      blameDecorationsRef.current = ed.deltaDecorations([], decos);
      setShowBlame(true);
    } catch (e) {
      toast.error(`Blame 加载失败: ${e}`);
    }
  };

  const gitItems = activeTab.kind === "file" && useGitStore.getState().repoRoot
    ? [
        { id: "sep-git", label: "", separator: true },
        { id: "git-blame-inline", label: showBlame ? "隐藏 Blame" : "显示 Blame", onClick: () => toggleBlame() },
        { id: "git-blame", label: "查看 Blame(新标签)", onClick: () => {
          useEditorStore.getState().openBlame({ filePath: activeTab.path, fileName: activeTab.name });
        } },
        { id: "git-history", label: "查看文件历史", onClick: () => {
          useEditorStore.getState().openHistory({ filePath: activeTab.path, fileName: activeTab.name });
        } },
        { id: "git-stage", label: "暂存此文件", onClick: async () => {
          const { repoRoot } = useGitStore.getState();
          if (repoRoot) {
            const rel = activeTab.path.replace(repoRoot + "/", "");
            await useGitStore.getState().stage([rel]);
            toast.success("已暂存");
          }
        } },
        { id: "git-compare", label: "与分支比较...", onClick: () => {
          setCompareTarget({ filePath: activeTab.path, fileName: activeTab.name });
        } },
      ]
    : [];

  return (
    <>
    <EditorContextMenu
      items={[
        { id: "cut", label: "剪切", shortcut: "Cmd+X", onClick: () => {
          if (!ed) return;
          const sel = ed.getSelection();
          if (sel && !sel.isEmpty()) {
            navigator.clipboard.writeText(ed.getModel()!.getValueInRange(sel));
            ed.executeEdits("cut", [{ range: sel, text: "" }]);
          }
        } },
        { id: "copy", label: "复制", shortcut: "Cmd+C", onClick: () => {
          if (!ed) return;
          const sel = ed.getSelection();
          if (sel && !sel.isEmpty()) {
            navigator.clipboard.writeText(ed.getModel()!.getValueInRange(sel));
          }
        } },
        { id: "paste", label: "粘贴", shortcut: "Cmd+V", onClick: async () => {
          if (!ed) return;
          const text = await navigator.clipboard.readText();
          const sel = ed.getSelection();
          if (sel && text) ed.executeEdits("paste", [{ range: sel, text }]);
        } },
        { id: "sep1", label: "", separator: true },
        { id: "find", label: "查找", shortcut: "Cmd+F", onClick: () => triggerEditorAction("actions.find") },
        { id: "replace", label: "替换", shortcut: "Cmd+Alt+F", onClick: () => triggerEditorAction("editor.action.startFindReplaceAction") },
        { id: "sep2", label: "", separator: true },
        { id: "format", label: "格式化代码", shortcut: "Shift+Alt+F", onClick: () => triggerEditorAction("editor.action.formatDocument") },
        { id: "command", label: "命令面板", shortcut: "Cmd+Shift+P", onClick: () => window.dispatchEvent(new KeyboardEvent("keydown", { metaKey: true, shiftKey: true, key: "p" })) },
        ...gitItems,
      ]}
    >
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
    </EditorContextMenu>
    <CompareBranchDialog
      open={compareTarget !== null}
      fileName={compareTarget?.fileName ?? ""}
      onClose={() => setCompareTarget(null)}
      onCompare={async (branch) => {
        if (compareTarget) {
          await useGitStore.getState().compareFileWithBranch(compareTarget.filePath, branch);
        }
        setCompareTarget(null);
      }}
    />
    </>
  );
}

/**
 * 分支比较选择弹窗
 */
function CompareBranchDialog({
  open,
  fileName,
  onClose,
  onCompare,
}: {
  open: boolean;
  fileName: string;
  onClose: () => void;
  onCompare: (branch: string) => void;
}) {
  const { branches, loadBranches } = useGitStore();
  const [selected, setSelected] = useState("");
  useEffect(() => {
    if (open) loadBranches();
  }, [open, loadBranches]);
  const localBranches = branches.filter((b) => !b.isRemote && !b.current);

  if (!open) return null;
  return (
    <div className="cmd-palette-overlay" onClick={onClose}>
      <div className="compare-branch-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="compare-branch-dialog__title">
          与分支比较: {fileName}
        </div>
        <div className="compare-branch-dialog__list">
          {localBranches.length === 0 ? (
            <div style={{ padding: 16, color: "var(--fg-muted)", textAlign: "center" }}>
              没有其他本地分支
            </div>
          ) : (
            localBranches.map((b) => (
              <button
                key={b.name}
                className={`compare-branch-dialog__item ${selected === b.name ? "compare-branch-dialog__item--active" : ""}`}
                onClick={() => setSelected(b.name)}
              >
                <span>⎇ {b.name}</span>
              </button>
            ))
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "8px 12px" }}>
          <button className="btn btn--secondary" onClick={onClose}>取消</button>
          <button
            className="btn btn--primary"
            disabled={!selected}
            onClick={() => { if (selected) onCompare(selected); }}
          >
            比较
          </button>
        </div>
      </div>
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

/** 便签编辑界面: 顶部标题栏 + Monaco 内容区
 * 编辑只更新内存 Tab(isDirty 跟随), 不立即写库;
 * Cmd+S 时才提交到 SQLite(见 EditorPane.handleSave)。
 * 重启后由会话草稿恢复未保存的内容。
 */
function NoteEditorSurface({
  tab,
  onMount,
  onChange,
}: {
  tab: import("../stores/editorStore").EditorTab;
  onMount: OnMount;
  onChange: (v: string | undefined) => void;
}) {
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

  // 标题修改: 只更新内存 Tab(标记 dirty), 不写库
  const onTitleChange = (title: string) => {
    useEditorStore.setState((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === tab.id
          ? {
              ...t,
              // 有自定义标题用标题, 否则仍按内容首行显示
              name: title.trim() ? title : noteDisplayTitle({ title: "", content: t.content }),
              noteTitle: title,
              isDirty: true,
            }
          : t
      ),
    }));
  };

  // 内容修改: 走 updateContent(设 isDirty), 不写库; 无自定义标题时实时更新 tab 名为首行
  const onContentChange = (v: string | undefined) => {
    onChange(v);
    // 没有自定义标题 → tab 名跟随内容首行
    if (!tab.noteTitle?.trim() && v !== undefined) {
      useEditorStore.setState((s) => ({
        tabs: s.tabs.map((t) =>
          t.id === tab.id ? { ...t, name: noteDisplayTitle({ title: "", content: v }) } : t
        ),
      }));
    }
  };

  // 语言切换: 只更新内存 Tab(标记 dirty), 不写库
  const onLangChange = (language: string) => {
    useEditorStore.setState((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === tab.id ? { ...t, language, isDirty: true } : t
      ),
    }));
  };

  // 快捷工具: 替换当前便签内容(JSON 格式化/压缩/校验, SQL 格式化/压缩)
  // action 由 NoteQuickTools 触发, 在这里执行实际转换
  const handleQuickAction = (action: string) => {
    const text = tab.content || "";
    try {
      if (action === "json-format") {
        const out = JSON.stringify(JSON.parse(text), null, 2);
        replaceContent(out);
        toast.success("JSON 已格式化");
      } else if (action === "json-minify") {
        const out = JSON.stringify(JSON.parse(text));
        replaceContent(out);
        toast.success("JSON 已压缩");
      } else if (action === "json-validate") {
        JSON.parse(text);
        toast.success("JSON 格式正确");
      } else if (action === "sql-format") {
        const out = sqlFormat(text, { language: "mysql" });
        replaceContent(out);
        toast.success("SQL 已格式化");
      } else if (action === "sql-minify") {
        const out = sqlFormat(text, { language: "mysql" }).replace(/\s+/g, " ").trim();
        replaceContent(out);
        toast.success("SQL 已压缩");
      }
    } catch (e) {
      toast.error(`操作失败: ${(e as Error).message}`);
    }
  };

  // 替换内容: 只更新内存 Tab(标记 dirty), 不写库(随 Cmd+S 或草稿暂存)
  const replaceContent = (newContent: string) => {
    useEditorStore.getState().updateContent(tab.id, newContent);
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
        <NoteQuickTools language={tab.language} onAction={handleQuickAction} />
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
          // 合成 path(带语言扩展名), 让 Monaco 按扩展名挂载对应 worker,
          // 从而获得完整的高亮 + 补全 + 校验; 切换语言时扩展名变化 → 模型重建 → worker 重连
          path={`note://${tab.noteId}.${getExtByLanguage(tab.language)}`}
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

/** 简易 blame 解析(行号 → 作者+时间) */
function parseBlameInline(output: string): Map<number, { author: string; time: string }> {
  const map = new Map<number, { author: string; time: string }>();
  const lines = output.split("\n");
  let currentLine = 0;
  let currentAuthor = "";
  let currentTime = "";
  for (const line of lines) {
    if (/^[0-9a-f]{40}/.test(line)) {
      const parts = line.split("\t");
      currentLine = parseInt(parts[2]) || 0;
    } else if (line.startsWith("author ")) {
      currentAuthor = line.slice(7).trim();
    } else if (line.startsWith("author-time ")) {
      const ts = parseInt(line.slice(12));
      const d = new Date(ts * 1000);
      currentTime = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
    } else if (line.startsWith("filename ") && currentLine > 0) {
      map.set(currentLine, { author: currentAuthor, time: currentTime });
    }
  }
  return map;
}

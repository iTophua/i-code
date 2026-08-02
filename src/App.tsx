import { useEffect, useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { ActivityBar } from "./components/ActivityBar";
import { Sidebar } from "./components/Sidebar";
import { EditorTabs } from "./components/EditorTabs";
import { EditorPane } from "./components/EditorPane";
import { StatusBar } from "./components/StatusBar";
import { VerticalResizer } from "./components/Resizer";
import { useLayoutStore } from "./stores/layoutStore";
import { useFileTreeStore } from "./stores/fileTreeStore";
import { useEditorStore } from "./stores/editorStore";
import { useNotesStore, noteDisplayTitle } from "./stores/notesStore";
import { useSettingsStore } from "./stores/settingsStore";
import { monaco } from "./monaco/setup";
import { ICODE_DARK_THEME, ICODE_LIGHT_THEME } from "./monaco/theme";
import { disposeAllLsp } from "./monaco/lsp-bridge";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { TerminalPanel } from "./components/TerminalPanel";
import { TitleBar } from "./components/TitleBar";
import { SettingsContent } from "./components/SettingsPanel";
import { ProblemsPanel } from "./components/ProblemsPanel";
import { ToastContainer } from "./components/Toast";
import { CommandPalette } from "./components/CommandPalette";
import { Breadcrumb } from "./components/Breadcrumb";
import { SplitEditorTabs } from "./components/SplitEditorTabs";
import { SplitEditorPane } from "./components/SplitEditorPane";
import { useState } from "react";
import {
  setSession,
  getSession,
  SESSION_KEYS,
  type SavedTab,
} from "./utils/session";
import { getLanguage } from "./utils/language";
import { addRecentProject } from "./utils/recentProjects";
import { toast } from "./stores/toastStore";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import "./styles/app.css";

export default function App() {
  const {
    sidebarVisible,
    sidebarWidth,
    sidebarView,
    panelVisible,
    panelView,
    zenMode,
    setSidebarView,
    setPanelView,
    setWorkspaceRoot,
    setSidebarWidth,
    toggleSidebar,
    togglePanel,
    toggleZen,
  } = useLayoutStore();
  const setRootPath = useFileTreeStore((s) => s.setRootPath);
  const splitEnabled = useEditorStore((s) => s.splitEnabled);
  const splitOrientation = useEditorStore((s) => s.splitOrientation);
  // 响应式订阅 tabs/activeTabId: 否则编辑后持久化 effect 的 deps 是死值, 草稿不会存
  const editorTabs = useEditorStore((s) => s.tabs);
  const editorActiveTabId = useEditorStore((s) => s.activeTabId);
  const [closeConfirm, setCloseConfirm] = useState<{ id: string; name: string } | null>(null);
  const [savingTab, setSavingTab] = useState(false);
  const [restored, setRestored] = useState(false);

  // 打开文件夹
  const handleOpenFolder = useCallback(async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "选择项目文件夹",
      });
      if (typeof selected === "string") {
        await setRootPath(selected);
        setWorkspaceRoot(selected);
        await setSession(SESSION_KEYS.workspaceRoot, selected);
        await addRecentProject(selected);
      }
    } catch (e) {
      console.error("打开文件夹失败:", e);
    }
  }, [setRootPath, setWorkspaceRoot]);

  // 关闭前保存当前 Tab(文件写磁盘, 便签存 SQLite), 成功后关闭
  const saveAndClose = useCallback(async (id: string) => {
    setSavingTab(true);
    try {
      const tab = useEditorStore
        .getState()
        .tabs.find((t) => t.id === id);
      if (!tab) {
        useEditorStore.getState().closeTab(id);
        return;
      }
      if (tab.kind === "note" && tab.noteId) {
        // 便签: 提交 标题/内容/语言 全量到 SQLite
        await useNotesStore.getState().updateNote(tab.noteId, {
          title: tab.noteTitle ?? "",
          content: tab.content,
          language: tab.language,
        });
      } else if (tab.kind === "file") {
        await invoke("write_file", { filePath: tab.path, content: tab.content });
      }
      useEditorStore.getState().markSaved(id);
      useEditorStore.getState().closeTab(id);
    } catch (e) {
      console.error("保存失败:", e);
      toast.error(`保存失败: ${e}`);
    } finally {
      setSavingTab(false);
      setCloseConfirm(null);
    }
  }, []);

  // ===== 启动时恢复会话 + 加载设置 =====
  useEffect(() => {
    (async () => {
      // 先加载设置
      await useSettingsStore.getState().load();
      // 同步隐藏文件设置到文件树
      const showHidden = useSettingsStore.getState().showHiddenFiles;
      useFileTreeStore.getState().setShowHidden(showHidden);
      // 恢复布局: 侧栏宽度 + 视图 + 可见性
      const savedWidth = await getSession<number>(SESSION_KEYS.sidebarWidth);
      if (savedWidth) setSidebarWidth(savedWidth);
      const savedView = await getSession<string>(SESSION_KEYS.sidebarView);
      if (savedView) {
        const validViews = ["explorer", "search", "git", "notes", "tools", "settings"];
        if (validViews.includes(savedView)) {
          useLayoutStore.getState().setSidebarView(savedView as typeof sidebarView);
        }
      }
      const savedVisible = await getSession<boolean>(SESSION_KEYS.sidebarVisible);
      if (savedVisible !== null) {
        useLayoutStore.setState({ sidebarVisible: savedVisible });
      }

      // 恢复项目根
      const savedRoot = await getSession<string>(SESSION_KEYS.workspaceRoot);
      if (savedRoot) {
        const exists = await invoke<boolean>("path_exists", { path: savedRoot });
        if (exists) {
          await setRootPath(savedRoot);
          setWorkspaceRoot(savedRoot);
        }
      }

      // 恢复打开的 Tab(恢复原样: 文件从磁盘读, 便签从 DB 读, 草稿覆盖内容并标记 dirty)
      const savedTabs = await getSession<SavedTab[]>(SESSION_KEYS.openTabs);
      if (savedTabs && savedTabs.length > 0) {
        // 先确保便签已从 DB 加载(便签 tab 恢复依赖 notes 列表)
        if (savedTabs.some((t) => t.kind === "note")) {
          await useNotesStore.getState().loadNotes(
            useLayoutStore.getState().workspaceRoot
          );
        }
        const { restoreTab } = useEditorStore.getState();
        for (const t of savedTabs) {
          try {
            if (t.kind === "note" && t.noteId) {
              // 便签: 从 SQLite 取最新内容作为基准
              const note = useNotesStore.getState().notes.find((n) => n.id === t.noteId);
              const baseContent = note?.content ?? "";
              const baseTitle = note?.title ?? "";
              const baseLang = note?.language ?? "plaintext";
              restoreTab({
                id: t.id,
                kind: "note",
                path: t.id,
                // tab 名: 草稿内容优先算显示标题, 否则基准内容
                name: noteDisplayTitle({ title: t.noteTitle ?? baseTitle, content: t.draft ?? baseContent }),
                isPreview: false,
                isDirty: t.draft != null,
                content: t.draft ?? baseContent,
                originalContent: baseContent,
                language: t.language || baseLang,
                noteId: t.noteId,
                noteTitle: t.noteTitle ?? baseTitle,
                cursor: t.cursor,
                scrollTop: t.scrollTop,
              });
            } else if (t.kind === "file") {
              // 文件: 磁盘不存在则跳过
              const exists = await invoke<boolean>("path_exists", { path: t.path });
              if (!exists) continue;
              const [diskContent] = await invoke<[string, string]>("read_file", {
                filePath: t.path,
              });
              restoreTab({
                id: t.id,
                kind: "file",
                path: t.path,
                name: t.name,
                isPreview: false,
                isDirty: t.draft != null,
                content: t.draft ?? diskContent,
                originalContent: diskContent,
                language: t.language || getLanguage(t.name),
                cursor: t.cursor,
                scrollTop: t.scrollTop,
              });
            }
            // 其它类型(diff/history/blame/log/merge/tool)不持久化恢复, 跳过
          } catch {
            /* 单个 tab 恢复失败不影响其它 */
          }
        }
      }

      // 恢复活跃 Tab
      const savedActive = await getSession<string>(SESSION_KEYS.activeTabId);
      if (savedActive) {
        const { tabs } = useEditorStore.getState();
        if (tabs.some((t) => t.id === savedActive)) {
          useEditorStore.getState().setActiveTab(savedActive);
        }
      }

      setRestored(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 应用退出时清理 LSP 进程
  useEffect(() => {
    return () => {
      disposeAllLsp();
      invoke("lsp_stop_all").catch(console.error);
    };
  }, []);

  // ===== 文件外部修改监听 =====
  const workspaceRoot = useLayoutStore((s) => s.workspaceRoot);
  useEffect(() => {
    if (!restored || !workspaceRoot) return;
    let unlisten: UnlistenFn | null = null;

    // 启动 watcher
    invoke("start_file_watch", { root: workspaceRoot }).catch(console.error);

    // 监听变化事件
    listen<{ path: string; kind: string }>("file-changed", (e) => {
      const { path, kind } = e.payload;
      const { tabs, activeTabId } = useEditorStore.getState();
      // 只提示当前打开的文件
      const affected = tabs.find(
        (t) => t.kind === "file" && t.path === path && t.id === activeTabId
      );
      if (affected && kind === "modified") {
        toast.info(`${affected.name} 被外部修改，重新载入？点击通知`);
        // 简化: 自动重载非 dirty 的文件
        if (!affected.isDirty) {
          invoke<[string, string]>("read_file", { filePath: path }).then(([content]) => {
            useEditorStore.getState().updateContent(affected.id, content);
            useEditorStore.getState().markSaved(affected.id);
          });
        }
      }
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
      invoke("stop_file_watch").catch(console.error);
    };
  }, [restored, workspaceRoot]);

  // ===== 状态变化时持久化 =====
  // 主题联动: settings.theme → <html data-theme> + Monaco setTheme
  const theme = useSettingsStore((s) => s.theme);
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    monaco.editor.setTheme(theme === "light" ? ICODE_LIGHT_THEME : ICODE_DARK_THEME);
  }, [theme]);

  // 持久化项目根(打开/切换项目时)
  useEffect(() => {
    if (!restored) return;
    setSession(SESSION_KEYS.workspaceRoot, useLayoutStore.getState().workspaceRoot);
  }, [restored, useLayoutStore.getState().workspaceRoot]);

  // 持久化侧栏宽度(防抖)
  useEffect(() => {
    if (!restored) return;
    const t = setTimeout(() => {
      setSession(SESSION_KEYS.sidebarWidth, sidebarWidth);
    }, 500);
    return () => clearTimeout(t);
  }, [restored, sidebarWidth]);

  // 持久化打开的 Tab(变化时防抖保存) —— 含草稿/光标, 重启后恢复原样
  useEffect(() => {
    if (!restored) return;
    const t = setTimeout(() => {
      const toSave: SavedTab[] = editorTabs
        .filter((tab) => !tab.isPreview)
        .map((tab) => ({
          id: tab.id,
          kind: tab.kind,
          path: tab.path,
          name: tab.name,
          language: tab.language,
          isPreview: false,
          // 有未保存修改 → 存草稿内容; 否则不存(恢复时从源头重读)
          draft: tab.isDirty ? tab.content : null,
          noteTitle: tab.noteTitle,
          noteId: tab.noteId,
          cursor: tab.cursor,
          scrollTop: tab.scrollTop,
        }));
      setSession(SESSION_KEYS.openTabs, toSave);
    }, 800);
    return () => clearTimeout(t);
  }, [restored, editorTabs]);

  // 持久化活跃 Tab
  useEffect(() => {
    if (!restored) return;
    setSession(SESSION_KEYS.activeTabId, editorActiveTabId);
  }, [restored, editorActiveTabId]);

  // 持久化侧栏视图 + 可见性(启动记忆"上次在什么菜单")
  useEffect(() => {
    if (!restored) return;
    setSession(SESSION_KEYS.sidebarView, sidebarView);
    setSession(SESSION_KEYS.sidebarVisible, sidebarVisible);
  }, [restored, sidebarView, sidebarVisible]);

  // ===== 全局快捷键 =====
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "o" && !e.shiftKey) {
        e.preventDefault();
        handleOpenFolder();
        return;
      }
      if (mod && e.key === "w" && !e.shiftKey) {
        e.preventDefault();
        const { tabs, activeTabId, closeTab } = useEditorStore.getState();
        const active = tabs.find((t) => t.id === activeTabId);
        if (!active) return;
        if (active.isDirty) {
          setCloseConfirm({ id: active.id, name: active.name });
        } else {
          closeTab(active.id);
        }
        return;
      }
      if ((mod && e.shiftKey && e.key === "t") || (mod && e.shiftKey && e.key === "T")) {
        e.preventDefault();
        useEditorStore.getState().reopenClosed();
        return;
      }
      if (mod && e.key === "b" && !e.shiftKey) {
        e.preventDefault();
        toggleSidebar();
        return;
      }
      if (mod && e.shiftKey && (e.key === "f" || e.key === "F")) {
        e.preventDefault();
        setSidebarView("search");
        return;
      }
      if (e.ctrlKey && e.key === "`") {
        e.preventDefault();
        togglePanel();
        return;
      }
          // Cmd/Ctrl+\ → 切换分栏
      if (mod && e.key === "\\" && !e.shiftKey) {
        e.preventDefault();
        useEditorStore.getState().toggleSplit();
        return;
      }
      // Cmd/Ctrl+K Z → Zen 模式
      if (mod && e.key.toLowerCase() === "z" && e.shiftKey) {
        e.preventDefault();
        toggleZen();
        return;
      }
    };
    window.addEventListener("keydown", onKey);

    const onCloseRequest = (e: Event) => {
      const { id, name } = (e as CustomEvent).detail;
      setCloseConfirm({ id, name });
    };
    window.addEventListener("tab-close-request", onCloseRequest);

    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("tab-close-request", onCloseRequest);
    };
  }, [handleOpenFolder, toggleSidebar, setSidebarView, togglePanel]);

  return (
    <div className={`app ${zenMode ? "app--zen" : ""}`}>
      {!zenMode && <TitleBar />}
      <div className="app__body">
        {!zenMode && <ActivityBar />}
        {sidebarVisible && (
          <>
            <aside className="app__sidebar" style={{ width: sidebarWidth }}>
              <Sidebar />
            </aside>
            <VerticalResizer />
          </>
        )}
        <main className="app__main">
          {sidebarView === "settings" ? (
            <SettingsContent />
          ) : (
            <>
              <EditorTabs />
              <Breadcrumb />
              <div
                className={`app__split-wrap ${splitEnabled ? "app__split-wrap--on" : ""} ${
                  splitEnabled ? `app__split-wrap--${splitOrientation}` : ""
                }`}
              >
                <div className={`app__editor-area ${splitEnabled ? "app__editor-area--split" : ""}`}>
                  {zenMode && (
                    <button
                      className="zen-exit"
                      onClick={toggleZen}
                      title="退出 Zen 模式 (Cmd+Shift+Z)"
                    >
                      退出 Zen
                    </button>
                  )}
                  <EditorPane />
                </div>
                {/* 分栏第二组 */}
                {splitEnabled && (
                  <>
                    <div className={`app__split-divider app__split-divider--${splitOrientation}`} />
                    <div className="app__editor-area app__editor-area--split">
                      <SplitEditorTabs />
                      <SplitEditorPane />
                    </div>
                  </>
                )}
              </div>
              {panelVisible && (
                <div className="app__panel">
                  <div className="app__panel-tabs">
                    <button
                      className={`app__panel-tab ${panelView === "terminal" ? "app__panel-tab--active" : ""}`}
                      onClick={() => setPanelView("terminal")}
                    >
                      终端
                    </button>
                    <button
                      className={`app__panel-tab ${panelView === "problems" ? "app__panel-tab--active" : ""}`}
                      onClick={() => setPanelView("problems")}
                    >
                      问题
                    </button>
                  </div>
                  {panelView === "terminal" ? <TerminalPanel /> : <ProblemsPanel />}
                </div>
              )}
            </>
          )}
        </main>
      </div>
      {!zenMode && <StatusBar />}
      <ConfirmDialog
        open={closeConfirm !== null}
        title="未保存的修改"
        message={
          closeConfirm
            ? `"${closeConfirm.name}" 有未保存的修改。\n要保存后再关闭吗？`
            : ""
        }
        cancelLabel="取消"
        confirmLabel="不保存"
        tertiaryLabel={savingTab ? "保存中..." : "保存"}
        danger
        onConfirm={() => {
          if (closeConfirm) useEditorStore.getState().closeTab(closeConfirm.id);
          setCloseConfirm(null);
        }}
        onCancel={() => setCloseConfirm(null)}
        onTertiary={() => {
          if (closeConfirm) saveAndClose(closeConfirm.id);
        }}
      />
      <ToastContainer />
      <CommandPalette />
    </div>
  );
}

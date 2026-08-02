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
  const [closeConfirm, setCloseConfirm] = useState<{ id: string; name: string } | null>(null);
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

  // ===== 启动时恢复会话 + 加载设置 =====
  useEffect(() => {
    (async () => {
      // 先加载设置
      await useSettingsStore.getState().load();
      // 同步隐藏文件设置到文件树
      const showHidden = useSettingsStore.getState().showHiddenFiles;
      useFileTreeStore.getState().setShowHidden(showHidden);
      // 恢复布局
      const savedWidth = await getSession<number>(SESSION_KEYS.sidebarWidth);
      if (savedWidth) setSidebarWidth(savedWidth);

      // 恢复项目根
      const savedRoot = await getSession<string>(SESSION_KEYS.workspaceRoot);
      if (savedRoot) {
        const exists = await invoke<boolean>("path_exists", { path: savedRoot });
        if (exists) {
          await setRootPath(savedRoot);
          setWorkspaceRoot(savedRoot);
        }
      }

      // 恢复打开的 Tab(从磁盘重新读内容, 不存未保存的草稿 - M1 阶段)
      const savedTabs = await getSession<
        { path: string; name: string }[]
      >(SESSION_KEYS.openTabs);
      if (savedTabs && savedTabs.length > 0) {
        const { openFile } = useEditorStore.getState();
        for (const t of savedTabs) {
          try {
            const exists = await invoke<boolean>("path_exists", { path: t.path });
            if (!exists) continue;
            const [content] = await invoke<[string, string]>("read_file", {
              filePath: t.path,
            });
            openFile({
              path: t.path,
              name: t.name,
              content,
              language: getLanguage(t.name),
              preview: false,
            });
          } catch {
            /* 文件可能已删除, 跳过 */
          }
        }
      }

      // 恢复活跃 Tab
      const savedActive = await getSession<string>(SESSION_KEYS.activeTabId);
      if (savedActive) {
        useEditorStore.getState().setActiveTab(savedActive);
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

  // 持久化打开的 Tab(变化时防抖保存)
  useEffect(() => {
    if (!restored) return;
    const t = setTimeout(() => {
      const { tabs } = useEditorStore.getState();
      // 只存正式 Tab(非预览), 存路径+名字
      const toSave = tabs
        .filter((tab) => !tab.isPreview)
        .map((t) => ({ path: t.path, name: t.name }));
      setSession(SESSION_KEYS.openTabs, toSave);
    }, 800);
    return () => clearTimeout(t);
  }, [restored, useEditorStore.getState().tabs]);

  // 持久化活跃 Tab
  useEffect(() => {
    if (!restored) return;
    setSession(SESSION_KEYS.activeTabId, useEditorStore.getState().activeTabId);
  }, [restored, useEditorStore.getState().activeTabId]);

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
              <div className={`app__editor-area ${useEditorStore.getState().splitEnabled ? "app__editor-area--split" : ""}`}>
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
              {useEditorStore.getState().splitEnabled && (
                <>
                  <div className="app__split-divider" />
                  <div className="app__editor-area app__editor-area--split">
                    <SplitEditorTabs />
                    <SplitEditorPane />
                  </div>
                </>
              )}
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
            ? `"${closeConfirm.name}" 有未保存的修改，关闭后将丢失。\n是否不保存直接关闭？`
            : ""
        }
        confirmLabel="不保存"
        danger
        onConfirm={() => {
          if (closeConfirm) useEditorStore.getState().closeTab(closeConfirm.id);
          setCloseConfirm(null);
        }}
        onCancel={() => setCloseConfirm(null)}
      />
      <ToastContainer />
      <CommandPalette />
    </div>
  );
}

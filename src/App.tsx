import { useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ActivityBar } from "./components/ActivityBar";
import { SplashScreen } from "./components/SplashScreen";
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
import { useGitStore } from "./stores/gitStore";
import { monaco } from "./monaco/setup";
import { ICODE_DARK_THEME, ICODE_LIGHT_THEME } from "./monaco/theme";
import { disposeAllLsp } from "./monaco/lsp-bridge";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { TerminalPanel } from "./components/TerminalPanel";
import { TitleBar } from "./components/TitleBar";
import { SettingsDialog } from "./components/SettingsDialog";
import { HelpDialog } from "./components/HelpDialog";
import { ProblemsPanel } from "./components/ProblemsPanel";
import { ToastContainer } from "./components/Toast";
import { CommandPalette } from "./components/CommandPalette";
import { Breadcrumb } from "./components/Breadcrumb";
import { SplitEditorTabs } from "./components/SplitEditorTabs";
import { SplitEditorPane } from "./components/SplitEditorPane";
import { DragSplitOverlay, useDragSplit } from "./components/DragSplitOverlay";
import { useState } from "react";
import {
  setSession,
  getSession,
  SESSION_KEYS,
  type SavedTab,
} from "./utils/session";
import { getLanguage } from "./utils/language";
import { openFolderDialog, isProjectSwitching } from "./utils/project";
import { toast } from "./stores/toastStore";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import "./styles/app.css";

export default function App() {
  // 精确订阅: 避免任意 layout 变化(mdView/panelHeight 等)都触发 App 全量重渲染
  const sidebarVisible = useLayoutStore((s) => s.sidebarVisible);
  const sidebarWidth = useLayoutStore((s) => s.sidebarWidth);
  const sidebarView = useLayoutStore((s) => s.sidebarView);
  const panelVisible = useLayoutStore((s) => s.panelVisible);
  const panelView = useLayoutStore((s) => s.panelView);
  const zenMode = useLayoutStore((s) => s.zenMode);
  const setSidebarView = useLayoutStore((s) => s.setSidebarView);
  const setPanelView = useLayoutStore((s) => s.setPanelView);
  const setWorkspaceRoot = useLayoutStore((s) => s.setWorkspaceRoot);
  const setSidebarWidth = useLayoutStore((s) => s.setSidebarWidth);
  const toggleSidebar = useLayoutStore((s) => s.toggleSidebar);
  const togglePanel = useLayoutStore((s) => s.togglePanel);
  const toggleZen = useLayoutStore((s) => s.toggleZen);
  const setRootPath = useFileTreeStore((s) => s.setRootPath);
  const splitEnabled = useEditorStore((s) => s.splitEnabled);
  const splitOrientation = useEditorStore((s) => s.splitOrientation);
  // 响应式订阅 tabs/activeTabId: 否则编辑后持久化 effect 的 deps 是死值, 草稿不会存
  const editorTabs = useEditorStore((s) => s.tabs);
  const editorActiveTabId = useEditorStore((s) => s.activeTabId);
  const [closeConfirm, setCloseConfirm] = useState<{ id: string; name: string } | null>(null);
  const [savingTab, setSavingTab] = useState(false);
  const [restored, setRestored] = useState(false);

  // 拖拽分屏:拖 tab 到编辑区四象限 → 按方向分屏并移动 tab
  const { wrapRef: splitDropRef, overlay: dragOverlay, handlers: splitDropHandlers } = useDragSplit(
    (tabId, fromSplit, zone) => {
      const st = useEditorStore.getState();
      // zone → orientation: left/right = horizontal(左右), top/bottom = vertical(上下)
      const orientation = zone === "left" || zone === "right" ? "horizontal" : "vertical";
      st.setSplitOrientation(orientation);
      // 若已在分屏且 tab 来自另一组, 按目标组移动
      if (fromSplit) {
        // 来自分屏组 → 确保在分屏组(已在);若拖到主区意图则移回主组
        // 简化:始终保持在分屏组(用户拖动是为了换方向)
      } else {
        // 来自主组 → 移到分屏组(moveToSplit 会自动开启分屏)
        if (!st.splitTabs.some((t) => t.id === tabId)) st.moveToSplit(tabId);
      }
    }
  );

  // 打开文件夹(走统一的 switchProject 入口: 保存当前项目 tab + 加载新项目 + 刷新 git)
  const handleOpenFolder = useCallback(async () => {
    try {
      await openFolderDialog();
    } catch (e) {
      console.error("打开文件夹失败:", e);
    }
  }, []);

  // 打开外部文件(从访达"打开方式"或拖拽): 读取并打开为 Tab
  const openExternalFiles = useCallback(async (paths: string[]) => {
    for (const filePath of paths) {
      try {
        const name = filePath.split("/").pop() || filePath;
        const lower = name.toLowerCase();
        // 图片走图片预览
        if (/\.(png|jpe?g|gif|svg|webp|bmp|ico)$/i.test(lower)) {
          useEditorStore.getState().openImage({ filePath, fileName: name });
          continue;
        }
        const [content] = await invoke<[string, string]>("read_file", { filePath });
        useEditorStore.getState().openFile({
          path: filePath,
          name,
          content,
          language: getLanguage(name),
          preview: false,
        });
      } catch (e) {
        toast.error(`打开失败: ${e}`);
      }
    }
  }, []);

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
      // 恢复设置分类(记忆上次选的分类)
      const savedCat = await getSession<string>(SESSION_KEYS.settingsCategory);
      if (savedCat) {
        const validCats = ["theme", "editor", "terminal", "window", "lsp"];
        if (validCats.includes(savedCat)) {
          useLayoutStore.setState({ settingsCategory: savedCat as any });
        }
      }

      // 恢复项目根(启动时直接设 root, 不走 switchProject 避免重复保存空状态)
      const savedRoot = await getSession<string>(SESSION_KEYS.workspaceRoot);
      if (savedRoot) {
        const exists = await invoke<boolean>("path_exists", { path: savedRoot });
        if (exists) {
          await setRootPath(savedRoot);
          setWorkspaceRoot(savedRoot);
          // 初始化 git 状态(让文件树分支切换器等全局可用, 不依赖切到 Git 面板)
          useGitStore.getState().refresh(savedRoot).catch(console.error);
        }
      }

      // 恢复打开的 Tab
      // 便签(notes): 全局保留, 从全局 openTabs key 读(便签不绑定项目)
      // 文件(files): 从项目级 key 读(按项目隔离, 避免跨项目串味)
      const savedTabs = await getSession<SavedTab[]>(SESSION_KEYS.openTabs);
      // 先恢复便签(若有)
      const noteTabs = savedTabs?.filter((t) => t.kind === "note") ?? [];
      if (noteTabs.length > 0) {
        // 确保便签已从 DB 加载
        await useNotesStore.getState().loadNotes(
          useLayoutStore.getState().workspaceRoot
        );
        const { restoreTab } = useEditorStore.getState();
        for (const t of noteTabs) {
          if (!t.noteId) continue;
          try {
            const note = useNotesStore.getState().notes.find((n) => n.id === t.noteId);
            const baseContent = note?.content ?? "";
            const baseTitle = note?.title ?? "";
            const baseLang = note?.language ?? "plaintext";
            restoreTab({
              id: t.id,
              kind: "note",
              path: t.id,
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
          } catch {
            /* 单个便签恢复失败不影响其它 */
          }
        }
      }
      // 恢复当前项目的文件 tab(从项目级 key 读)
      if (savedRoot) {
        const { loadProjectTabs } = await import("./utils/session");
        const projState = await loadProjectTabs(savedRoot);
        if (projState?.tabs && projState.tabs.length > 0) {
          for (const t of projState.tabs) {
            try {
              // 文件: 磁盘不存在则跳过
              const exists = await invoke<boolean>("path_exists", { path: t.path });
              if (!exists) continue;
              const [diskContent] = await invoke<[string, string]>("read_file", {
                filePath: t.path,
              });
              useEditorStore.getState().restoreTab({
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
            } catch {
              /* 单个 tab 恢复失败不影响其它 */
            }
          }
          // 恢复激活 tab(若仍存在)
          if (projState.activeTabId) {
            const { tabs } = useEditorStore.getState();
            if (tabs.some((t) => t.id === projState.activeTabId)) {
              useEditorStore.getState().setActiveTab(projState.activeTabId);
            }
          }
        } else if (projState === null) {
          // 项目级 key 无存档(首次或被关闭清除过):尝试从旧的全局 key 迁移一次文件 tab
          const oldFileTabs = savedTabs?.filter((t) => t.kind === "file" || t.kind === "image") ?? [];
          if (oldFileTabs.length > 0) {
            for (const t of oldFileTabs) {
              try {
                if (t.kind === "image") {
                  const exists = await invoke<boolean>("path_exists", { path: t.path });
                  if (!exists) continue;
                  useEditorStore.getState().openImage({ filePath: t.path, fileName: t.name });
                } else {
                  const exists = await invoke<boolean>("path_exists", { path: t.path });
                  if (!exists) continue;
                  const [diskContent] = await invoke<[string, string]>("read_file", {
                    filePath: t.path,
                  });
                  useEditorStore.getState().restoreTab({
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
              } catch {
                /* 迁移失败忽略 */
              }
            }
          }
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
    let mounted = true;

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
      // 卸载早于 resolve 时, 立即注销避免监听器泄漏
      if (mounted) unlisten = fn;
      else fn();
    });

    return () => {
      mounted = false;
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
  // 便签 → 全局 key(不绑定项目); 文件类(file/image/...) → 项目级 key(按项目隔离)
  // 切换项目期间抑制:避免 closeAllFiles 后空 tab 触发写入, 覆盖 switchProject 刚保存的状态
  useEffect(() => {
    if (!restored) return;
    const t = setTimeout(async () => {
      // 项目切换中 → 跳过(switchProject 自己负责保存/加载)
      if (isProjectSwitching()) return;
      const allTabs = useEditorStore.getState();
      const mainTabs = allTabs.tabs;
      const splitTabs = allTabs.splitTabs;
      const nonPreview = [...mainTabs, ...splitTabs].filter((tab) => !tab.isPreview);
      const toSaved = (tab: (typeof nonPreview)[number]): SavedTab => ({
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
      });
      // 便签 → 全局 openTabs(便签全局, 不随项目走)
      const noteTabs = nonPreview.filter((t) => t.kind === "note").map(toSaved);
      await setSession(SESSION_KEYS.openTabs, noteTabs);
      // 文件类(file/image/blame/history/log/merge/diff/tool) → 项目级 key(当前项目)
      const cur = useLayoutStore.getState().workspaceRoot;
      if (cur && !isProjectSwitching()) {
        const fileTabs = nonPreview
          .filter((t) => t.kind !== "note")
          .map(toSaved);
        // 活跃 tab 若是文件类, 记到项目级; 便签活跃不记
        const activeTab = nonPreview.find((t) => t.id === editorActiveTabId);
        const activeId =
          activeTab && activeTab.kind !== "note" ? editorActiveTabId : null;
        const { saveProjectTabs } = await import("./utils/session");
        await saveProjectTabs(cur, fileTabs, activeId);
      }
    }, 800);
    return () => clearTimeout(t);
  }, [restored, editorTabs, editorActiveTabId]);

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
      // Cmd+, → 打开/关闭设置
      if (mod && e.key === ",") {
        e.preventDefault();
        useLayoutStore.getState().toggleSettings();
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

  // ===== 从访达"打开方式 → iCode" / 拖拽文件到窗口 =====
  useEffect(() => {
    if (!restored) return;
    let unlistenDrop: UnlistenFn | null = null;
    let unlistenOpen: UnlistenFn | null = null;
    let mounted = true;
    // 拖拽文件到窗口(Tauri 2: getCurrentWebview().onDragDropEvent)
    getCurrentWebview()
      .onDragDropEvent((e) => {
        if (e.payload.type === "drop" && e.payload.paths.length > 0) {
          openExternalFiles(e.payload.paths);
        }
      })
      .then((fn) => {
        if (mounted) unlistenDrop = fn;
        else fn();
      });
    // macOS: 访达"打开方式"传来的文件(应用已运行时, RunEvent::Opened → Rust emit)
    listen<string[]>("open-external-files", (e) => {
      if (e.payload && e.payload.length > 0) {
        openExternalFiles(e.payload);
      }
    }).then((fn) => {
      if (mounted) unlistenOpen = fn;
      else fn();
    });
    // macOS: 首次启动时前端还没 ready, emit 会丢失 → 主动拉取 Rust 缓存的待打开文件
    invoke<string[]>("take_pending_files")
      .then((files) => {
        if (files.length > 0) openExternalFiles(files);
      })
      .catch(() => {});
    return () => {
      mounted = false;
      unlistenDrop?.();
      unlistenOpen?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restored, openExternalFiles]);

  return (
    <div className={`app ${zenMode ? "app--zen" : ""}`}>
      <SplashScreen done={restored} />
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
          <>
            <EditorTabs />
            <Breadcrumb />
              <div
                ref={splitDropRef}
                className={`app__split-wrap ${splitEnabled ? "app__split-wrap--on" : ""} ${
                  splitEnabled ? `app__split-wrap--${splitOrientation}` : ""
                }`}
                {...splitDropHandlers}
              >
                {dragOverlay && <DragSplitOverlay rect={dragOverlay.rect} zone={dragOverlay.zone} />}
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
              <div className={`app__panel ${panelVisible ? "" : "app__panel--hidden"}`}>
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
                {/* 两个面板都常驻(display 切换), 避免终端实例被销毁重建 */}
                <div className={panelView === "terminal" ? "panel__view--active" : "panel__view--hidden"}>
                  <TerminalPanel />
                </div>
                <div className={panelView === "problems" ? "panel__view--active" : "panel__view--hidden"}>
                  <ProblemsPanel visible={panelView === "problems"} />
                </div>
              </div>
          </>
        </main>
      </div>
      {!zenMode && <StatusBar />}
      <SettingsDialog />
      <HelpDialog />
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

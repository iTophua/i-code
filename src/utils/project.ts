/**
 * 项目(工作区)切换 / 关闭的统一入口
 *
 * 设计:
 * - 切换项目 A → B:保存 A 的文件 tab 状态(便签全局保留),加载 B 上次状态
 * - 关闭项目:清空文件 tab 且不记忆(下次打开是干净的)
 *
 * 消除 App.tsx / WelcomePage 三处重复的 setRootPath + setWorkspaceRoot + addRecentProject。
 * 便签(note)是全局的、不绑定项目 → 切换/关闭时始终保留。
 *
 * 切换时同步处理的副作用:
 *  - Monaco model 释放(closeAllFiles 内部 dispose)
 *  - 分屏状态重置(避免旧项目文件残留在第二组)
 *  - LSP 连接销毁(旧项目的语言服务器停止)
 *  - git 状态刷新(分支徽章 / 改动数)
 *  - 文件 watcher 重启(App.tsx 的 effect 依赖 workspaceRoot 自动处理)
 *
 * 持久化分类:
 *  - 便签(note) → 全局 openTabs key(不绑定项目)
 *  - 文件类(file/image/blame/history/log/merge/diff/tool) → 项目级 key
 *  - 关闭项目 → 写 tombstone(空数组 + cleared 标记), 启动迁移时识别"已清除"跳过
 */
import { invoke } from "@tauri-apps/api/core";
import { useEditorStore, type EditorTab } from "../stores/editorStore";
import { useLayoutStore } from "../stores/layoutStore";
import { useFileTreeStore } from "../stores/fileTreeStore";
import { useGitStore } from "../stores/gitStore";
import { disposeAllLsp } from "../monaco/lsp-bridge";
import { addRecentProject } from "./recentProjects";
import { getLanguage } from "./language";
import {
  setSession,
  SESSION_KEYS,
  saveProjectTabs,
  loadProjectTabs,
  clearProjectTabs,
  type SavedTab,
} from "./session";

/** 切换中标记:抑制 App.tsx 防抖自动保存, 避免 closeAllFiles 后空 tab 覆盖刚保存的项目状态 */
let switchingInProgress = false;
export function isProjectSwitching(): boolean {
  return switchingInProgress;
}

/** 从 EditorTab 提取持久化所需字段 */
function toSavedTab(tab: EditorTab): SavedTab {
  return {
    id: tab.id,
    kind: tab.kind,
    path: tab.path,
    name: tab.name,
    language: tab.language,
    isPreview: false,
    // 有未保存修改 → 存草稿; 否则不存(恢复时从磁盘重读)
    draft: tab.isDirty ? tab.content : null,
    cursor: tab.cursor,
    scrollTop: tab.scrollTop,
  };
}

/** 收集当前项目的所有"文件类" tab(主组 + 分屏组), 排除便签 */
function collectProjectTabs(): SavedTab[] {
  const { tabs, splitTabs } = useEditorStore.getState();
  // kind !== "note" 的都算项目级(file/image/blame/history/log/merge/diff/tool)
  return [...tabs, ...splitTabs]
    .filter((t) => t.kind !== "note" && !t.isPreview)
    .map(toSavedTab);
}

/** 恢复单个文件 tab(读磁盘内容 + restoreTab) */
async function restoreFileTab(t: SavedTab): Promise<void> {
  const exists = await invoke<boolean>("path_exists", { path: t.path });
  if (!exists) return;
  if (t.kind === "image") {
    // 图片:只记路径, 不存内容
    useEditorStore.getState().openImage({ filePath: t.path, fileName: t.name });
    return;
  }
  const [diskContent] = await invoke<[string, string]>("read_file", { filePath: t.path });
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

/**
 * 切换到目标项目(传 null = 关闭到欢迎页, 但不删除记忆)
 *
 * 流程:
 * 1. 切换中标记 → 抑制自动保存(防止 closeAllFiles 后空 tab 覆盖刚保存的状态)
 * 2. 切换到自身 → 短路(避免 dispose+重建 model 导致 undo 栈丢失/闪烁)
 * 3. 保存当前项目的文件 tab 状态(若有当前项目)
 * 4. 关闭旧项目的文件 tab + 重置分屏 + 停止旧 LSP(便签保留)
 * 5. 设置新项目 root(文件树自动读项目级 key 恢复展开状态)
 * 6. 加载新项目上次的文件 tab(若有存档)
 * 7. 刷新 git(修复现存 bug: 切换项目后分支徽章不更新)
 */
export async function switchProject(newRoot: string | null): Promise<void> {
  // 并发保护:上一次切换未完成时, 直接忽略新请求(避免状态混乱)
  if (switchingInProgress) return;
  switchingInProgress = true;
  try {
    const editor = useEditorStore.getState();
    const layout = useLayoutStore.getState();
    const cur = layout.workspaceRoot;

    // 2) 切换到自身 → 短路(避免无谓的 dispose + 重建, 防丢失 undo 栈)
    if (newRoot && newRoot === cur) return;

    // 3) 保存当前项目的文件 tab 状态(便签全局保留不存)
    if (cur) {
      const fileTabs = collectProjectTabs();
      // 活跃 tab 若是文件类, 记到项目级
      const allTabs = [...editor.tabs, ...editor.splitTabs];
      const activeTab = allTabs.find((t) => t.id === editor.activeTabId);
      const activeId =
        activeTab && activeTab.kind !== "note" ? editor.activeTabId : null;
      await saveProjectTabs(cur, fileTabs, activeId);
    }

    // 4) 关闭旧项目的文件 tab(含分屏组) + 重置分屏 + 停止旧 LSP
    useEditorStore.getState().closeAllFiles();
    // 重置分屏(避免旧项目文件残留在第二组; 便签若在分屏组会被移回主组)
    if (useEditorStore.getState().splitEnabled) {
      useEditorStore.setState((s) => ({
        splitEnabled: false,
        tabs: [...s.tabs, ...s.splitTabs],
        splitTabs: [],
        splitActiveId: null,
      }));
    }
    // 停止旧项目的语言服务器(切换后旧 LSP 进程不再需要)
    disposeAllLsp();
    invoke("lsp_stop_all").catch(console.error);

    // 5) 先切 workspaceRoot 再 setRootPath:
    //    确保后续防抖持久化 effect(若在切换中触发)写入"新"项目 key, 不会覆盖步骤3刚保存的旧项目 tab。
    layout.setWorkspaceRoot(newRoot);
    await useFileTreeStore.getState().setRootPath(newRoot ?? "");

    // 6/7) 有新项目时:加最近列表 + 加载该项目的文件 tab + 刷新 git
    if (newRoot) {
      await addRecentProject(newRoot);

      const saved = await loadProjectTabs(newRoot);
      if (saved?.tabs && saved.tabs.length > 0) {
        for (const t of saved.tabs) {
          try {
            await restoreFileTab(t);
          } catch {
            /* 单个 tab 恢复失败不影响其它 */
          }
        }
        // 恢复激活 tab:若保存的 active 仍存在则用它, 否则 fallback 到第一个文件 tab
        const { tabs: restoredTabs } = useEditorStore.getState();
        if (saved.activeTabId && restoredTabs.some((t) => t.id === saved.activeTabId)) {
          useEditorStore.getState().setActiveTab(saved.activeTabId);
        } else {
          // fallback:激活第一个非便签 tab(若全部恢复失败则保持便签/null)
          const firstFile = restoredTabs.find((t) => t.kind !== "note");
          if (firstFile) useEditorStore.getState().setActiveTab(firstFile.id);
        }
      }

      // 刷新 git(分支徽章 / 改动数)
      await useGitStore.getState().refresh(newRoot).catch(console.error);
    } else {
      // 关闭到无项目:清空 git 状态
      useGitStore.setState({ repoRoot: null, branch: "", changes: [], stagedCount: 0 });
    }

    // 持久化当前 workspaceRoot(启动时恢复)
    await setSession(SESSION_KEYS.workspaceRoot, newRoot);
  } finally {
    switchingInProgress = false;
  }
}

/**
 * 关闭当前项目
 *
 * 与 switchProject(null) 的区别:关闭项目会**删除**该项目的 tab 记忆,
 * 下次打开时是干净状态(不记忆)。
 *
 * 实现:写 tombstone(cleared: true)而非删除 key, 让启动迁移逻辑能区分
 * "首次打开(无 key)" 和 "已关闭(不记忆)"。
 */
export async function closeProject(): Promise<void> {
  if (switchingInProgress) return;
  switchingInProgress = true;
  try {
    const layout = useLayoutStore.getState();
    const cur = layout.workspaceRoot;

    // 关闭文件 tab(含分屏组, 便签保留)
    useEditorStore.getState().closeAllFiles();
    // 重置分屏
    if (useEditorStore.getState().splitEnabled) {
      useEditorStore.setState((s) => ({
        splitEnabled: false,
        tabs: [...s.tabs, ...s.splitTabs],
        splitTabs: [],
        splitActiveId: null,
      }));
    }
    // 停止 LSP
    disposeAllLsp();
    invoke("lsp_stop_all").catch(console.error);

    // 删除该项目的记忆(tombstone: cleared=true, 启动迁移时跳过)
    if (cur) {
      await clearProjectTabs(cur);
    }

    // 清空文件树 + workspaceRoot
    await useFileTreeStore.getState().setRootPath("");
    layout.setWorkspaceRoot(null);
    useGitStore.setState({ repoRoot: null, branch: "", changes: [], stagedCount: 0 });

    // 持久化关闭状态
    await setSession(SESSION_KEYS.workspaceRoot, null);
  } finally {
    switchingInProgress = false;
  }
}

/**
 * 打开文件夹选择对话框并切换到选中的项目
 * @returns 选中的路径(未选中返回 null)
 */
export async function openFolderDialog(): Promise<string | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const selected = await open({
    directory: true,
    multiple: false,
    title: "选择项目文件夹",
  });
  if (typeof selected === "string") {
    await switchProject(selected);
    return selected;
  }
  return null;
}

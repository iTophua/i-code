import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { setSession, getSession, SESSION_KEYS } from "../utils/session";

/**
 * 文件树状态管理
 * 用扁平可见列表 + 虚拟滚动渲染
 */

export interface TreeNode {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  children?: TreeNode[];
  /** 是否已加载子项(目录懒加载) */
  loaded?: boolean;
}

/** 可见节点(带深度,供缩进) */
export interface VisibleNode extends TreeNode {
  depth: number;
  expanded: boolean;
}

interface FileTreeStore {
  rootPath: string | null;
  treeData: TreeNode[];
  visibleNodes: VisibleNode[];
  expandedPaths: Set<string>;
  filter: string;
  selectedPath: string | null;
  showHidden: boolean;
  sortBy: "name" | "modified";

  setRootPath: (path: string) => Promise<void>;
  refreshTree: () => Promise<void>;
  toggleNode: (node: VisibleNode) => Promise<void>;
  setFilter: (f: string) => void;
  setSelected: (path: string | null) => void;
  setShowHidden: (v: boolean) => void;
  setSortBy: (s: "name" | "modified") => void;
  recomputeVisible: () => void;
}

export const useFileTreeStore = create<FileTreeStore>((set, get) => ({
  rootPath: null,
  treeData: [],
  visibleNodes: [],
  expandedPaths: new Set(),
  filter: "",
  selectedPath: null,
  showHidden: false,
  sortBy: "name",

  setRootPath: async (path) => {
    // 恢复上次展开的目录(从 session 读)
    let restoredExpanded = new Set<string>();
    try {
      const saved = await getSession<string[]>(SESSION_KEYS.treeExpanded);
      if (saved && saved.length > 0) restoredExpanded = new Set(saved);
    } catch { /* ignore */ }
    const savedSelected = await getSession<string>(SESSION_KEYS.treeSelected);
    set({
      rootPath: path,
      treeData: [],
      expandedPaths: restoredExpanded,
      selectedPath: savedSelected ?? null,
      filter: "",
    });
    await get().refreshTree();
  },

  setShowHidden: (v: boolean) => {
    set({ showHidden: v });
    get().refreshTree();
  },

  setSortBy: (s) => {
    set({ sortBy: s });
    get().refreshTree();
  },

  refreshTree: async () => {
    const { rootPath, expandedPaths, showHidden, sortBy } = get();
    if (!rootPath) return;
    try {
      const entries = (await invoke("list_directory", { showHidden, sortBy, 
        dirPath: rootPath,
      })) as TreeNode[];
      // 重新加载之前展开的目录
      const treeData = entries.map((e) => ({ ...e }));
      await reloadExpanded(treeData, expandedPaths);
      set({ treeData });
      get().recomputeVisible();
    } catch (e) {
      console.error("刷新文件树失败:", e);
    }
  },

  toggleNode: async (node) => {
    if (!node.isDir) return;
    const { expandedPaths, treeData, showHidden, sortBy } = get();
    const newExpanded = new Set(expandedPaths);

    if (expandedPaths.has(node.path)) {
      newExpanded.delete(node.path);
    } else {
      newExpanded.add(node.path);
      // 懒加载子项
      const cached = findNode(treeData, node.path);
      if (cached && !cached.loaded) {
        try {
          const children = (await invoke("list_directory", { showHidden, sortBy, 
            dirPath: node.path,
          })) as TreeNode[];
          cached.children = children;
          cached.loaded = true;
        } catch (e) {
          console.error("展开目录失败:", e);
        }
      }
    }
    set({ expandedPaths: newExpanded, treeData: [...treeData] });
    get().recomputeVisible();
    // 持久化展开状态(防抖由调用频率自然限流)
    setSession(SESSION_KEYS.treeExpanded, [...newExpanded]).catch(() => {});
  },

  setFilter: (f) => {
    set({ filter: f });
    get().recomputeVisible();
  },

  setSelected: (path) => {
    set({ selectedPath: path });
    if (path) setSession(SESSION_KEYS.treeSelected, path).catch(() => {});
  },

  recomputeVisible: () => {
    const { treeData, expandedPaths, filter } = get();
    const result: VisibleNode[] = [];
    const fl = filter.toLowerCase().trim();

    const walk = (nodes: TreeNode[], depth: number) => {
      for (const node of nodes) {
        const nameMatch = node.name.toLowerCase().includes(fl);
        if (fl) {
          // 过滤模式: 只显示匹配的文件 + 包含匹配子孙的目录(强制展开)
          if (!nameMatch && !node.isDir) continue;
          if (!nameMatch && node.isDir && !hasDescendantMatch(node, fl))
            continue;
        }
        const expanded = expandedPaths.has(node.path);
        result.push({ ...node, depth, expanded });
        // 过滤模式下强制展开含匹配项的目录
        const shouldWalkChildren =
          node.isDir &&
          node.children &&
          (expanded || (fl && hasDescendantMatch(node, fl)));
        if (shouldWalkChildren) {
          walk(node.children!, depth + 1);
        }
      }
    };
    walk(treeData, 0);
    set({ visibleNodes: result });
  },
}));

/** 在树中查找节点 */
function findNode(nodes: TreeNode[], path: string): TreeNode | null {
  for (const n of nodes) {
    if (n.path === path) return n;
    if (n.children) {
      const found = findNode(n.children, path);
      if (found) return found;
    }
  }
  return null;
}

/** 目录是否有子孙名匹配 */
function hasDescendantMatch(node: TreeNode, fl: string): boolean {
  if (!node.children) return false;
  for (const c of node.children) {
    if (c.name.toLowerCase().includes(fl)) return true;
    if (c.isDir && hasDescendantMatch(c, fl)) return true;
  }
  return false;
}

/** 重新加载所有已展开目录的子项 */
async function reloadExpanded(nodes: TreeNode[], expanded: Set<string>) {
  const { showHidden, sortBy } = useFileTreeStore.getState();
  for (const node of nodes) {
    if (node.isDir && expanded.has(node.path)) {
      try {
        node.children = (await invoke("list_directory", { showHidden, sortBy,
          dirPath: node.path,
        })) as TreeNode[];
        node.loaded = true;
        if (node.children) await reloadExpanded(node.children, expanded);
      } catch {
        /* 忽略单个目录失败 */
      }
    }
  }
}

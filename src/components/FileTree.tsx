import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useFileTreeStore, type VisibleNode } from "../stores/fileTreeStore";
import { useEditorStore } from "../stores/editorStore";
import { useGitStore, type FileStatus } from "../stores/gitStore";
import { invoke } from "@tauri-apps/api/core";
import { getFileIconType, getLanguage } from "../utils/language";
import { FileIcon } from "./FileIcon";
import {
  ChevronRight,
  ChevronDown,
  NewFileIcon,
  NewFolderIcon,
  RefreshIcon,
  CollapseAllIcon,
} from "./Icons";
import { ContextMenu, type MenuItem } from "./ContextMenu";
import { InlineInput } from "./InlineInput";
import { ConfirmDialog } from "./ConfirmDialog";
import { createFile, createDir, deletePath, renamePath, copyPath, movePath } from "../utils/fileOps";
import { toast } from "../stores/toastStore";
import { useClipStore } from "../stores/clipStore";
import "../styles/filetree.css";

const ITEM_HEIGHT = 22;
const OVERSCAN = 8;

/** 内联编辑状态 */
type InlineEdit =
  | { type: "new-file" | "new-dir"; parentPath: string }
  | { type: "rename"; node: VisibleNode }
  | null;

export function FileTree() {
  const {
    visibleNodes,
    filter,
    setFilter,
    toggleNode,
    setSelected,
    selectedPath,
    rootPath,
    refreshTree,
    recomputeVisible,
    sortBy,
    setSortBy,
  } = useFileTreeStore();
  const isDirty = useEditorStore((s) => s.isDirty);
  // Git 状态: 构建"相对路径 → 状态"映射, 供文件树着色
  const gitChanges = useGitStore((s) => s.changes);
  const gitRoot = useGitStore((s) => s.repoRoot);
  const gitStatusMap = useMemo(() => {
    const map = new Map<string, FileStatus>();
    for (const c of gitChanges) {
      map.set(c.path, c.status);
      // 同时标记父目录为 "modified"(目录含改动时也着色)
      const parts = c.path.split("/");
      for (let i = 1; i < parts.length; i++) {
        const dir = parts.slice(0, i).join("/");
        if (!map.has(dir)) map.set(dir, "modified");
      }
    }
    return map;
  }, [gitChanges]);

  // 查节点的 git 状态(用相对路径)
  const getGitStatus = useCallback(
    (node: VisibleNode): FileStatus | null => {
      if (!gitRoot || !node.path.startsWith(gitRoot)) return null;
      const rel = node.path.slice(gitRoot.length + 1);
      return gitStatusMap.get(rel) || null;
    },
    [gitRoot, gitStatusMap]
  );

  const [scrollTop, setScrollTop] = useState(0);
  const [viewportH, setViewportH] = useState(600);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const clickTimer = useRef<number | null>(null);

  const [menu, setMenu] = useState<{ x: number; y: number; node: VisibleNode | null } | null>(null);
  const [inlineEdit, setInlineEdit] = useState<InlineEdit>(null);
  const [confirmDelete, setConfirmDelete] = useState<VisibleNode | null>(null);

  // 监听容器尺寸
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewportH(el.clientHeight));
    ro.observe(el);
    setViewportH(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  // 虚拟滚动
  const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - OVERSCAN);
  const endIndex = Math.min(
    visibleNodes.length,
    Math.ceil((scrollTop + viewportH) / ITEM_HEIGHT) + OVERSCAN
  );
  const slice = visibleNodes.slice(startIndex, endIndex);
  const totalHeight = visibleNodes.length * ITEM_HEIGHT;
  const offsetY = startIndex * ITEM_HEIGHT;

  // 选中索引(供键盘导航)
  const selectedIndex = visibleNodes.findIndex((n) => n.path === selectedPath);

  const scrollRowIntoView = useCallback((index: number) => {
    const top = index * ITEM_HEIGHT;
    const el = containerRef.current;
    if (!el) return;
    if (top < el.scrollTop) {
      el.scrollTop = top;
    } else if (top + ITEM_HEIGHT > el.scrollTop + el.clientHeight) {
      el.scrollTop = top + ITEM_HEIGHT - el.clientHeight;
    }
  }, []);

  // 读取并打开文件
  const openFileInternal = useCallback(
    async (node: VisibleNode, preview: boolean) => {
      const store = useEditorStore.getState();
      setSelected(node.path);
      try {
        // 检查文件大小, >20MB 用大文件查看器
        const size = await invoke<number>("get_file_size", { filePath: node.path });
        if (size > 20 * 1024 * 1024) {
          store.openLog({ filePath: node.path, fileName: node.name });
          return;
        }
        const [content] = await invoke<[string, string]>("read_file", {
          filePath: node.path,
        });
        store.openFile({
          path: node.path,
          name: node.name,
          content,
          language: getLanguage(node.name),
          preview,
        });
      } catch (e) {
        console.error("打开文件失败:", e);
      }
    },
    [setSelected]
  );

  // 单击预览 + 双击正式
  const handleClick = useCallback(
    (node: VisibleNode) => {
      if (node.isDir) {
        toggleNode(node);
        return;
      }
      if (clickTimer.current) {
        clearTimeout(clickTimer.current);
        clickTimer.current = null;
      }
      clickTimer.current = window.setTimeout(() => {
        openFileInternal(node, true);
      }, 200);
    },
    [toggleNode, openFileInternal]
  );

  const handleDoubleClick = useCallback(
    (node: VisibleNode) => {
      if (node.isDir) return;
      if (clickTimer.current) {
        clearTimeout(clickTimer.current);
        clickTimer.current = null;
      }
      openFileInternal(node, false);
    },
    [openFileInternal]
  );

  // 右键菜单
  const handleContextMenu = (e: React.MouseEvent, node: VisibleNode | null) => {
    e.preventDefault();
    e.stopPropagation();
    if (node) setSelected(node.path);
    setMenu({ x: e.clientX, y: e.clientY, node });
  };

  // 键盘导航
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (inlineEdit || menu) return; // 编辑/菜单时不抢快捷键
    if (selectedIndex < 0 && visibleNodes.length > 0) {
      setSelected(visibleNodes[0].path);
      scrollRowIntoView(0);
      return;
    }
    const node = visibleNodes[selectedIndex];
    if (!node) return;

    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault();
        const next = visibleNodes[selectedIndex + 1];
        if (next) {
          setSelected(next.path);
          scrollRowIntoView(selectedIndex + 1);
        }
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        const prev = visibleNodes[selectedIndex - 1];
        if (prev) {
          setSelected(prev.path);
          scrollRowIntoView(selectedIndex - 1);
        }
        break;
      }
      case "ArrowRight": {
        e.preventDefault();
        if (node.isDir && !node.expanded) {
          toggleNode(node);
        } else if (!node.isDir) {
          openFileInternal(node, true);
        }
        break;
      }
      case "ArrowLeft": {
        e.preventDefault();
        if (node.isDir && node.expanded) {
          toggleNode(node);
        }
        break;
      }
      case "Enter": {
        e.preventDefault();
        if (node.isDir) {
          toggleNode(node);
        } else {
          openFileInternal(node, false);
        }
        break;
      }
      case "F2": {
        e.preventDefault();
        setInlineEdit({ type: "rename", node });
        break;
      }
      case "Delete":
      case "Backspace": {
        e.preventDefault();
        setConfirmDelete(node);
        break;
      }
    }
  };

  // 内联输入确认
  const handleInlineConfirm = async (value: string) => {
    if (!inlineEdit || !rootPath) {
      setInlineEdit(null);
      return;
    }
    try {
      if (inlineEdit.type === "new-file") {
        const newPath = `${inlineEdit.parentPath}/${value}`;
        await createFile(newPath);
      } else if (inlineEdit.type === "new-dir") {
        const newPath = `${inlineEdit.parentPath}/${value}`;
        await createDir(newPath);
      } else if (inlineEdit.type === "rename") {
        const parent = inlineEdit.node.path.substring(
          0,
          inlineEdit.node.path.lastIndexOf("/")
        );
        const newPath = `${parent}/${value}`;
        if (newPath !== inlineEdit.node.path) {
          await renamePath(inlineEdit.node.path, newPath);
        }
      }
    } catch (e) {
      console.error("文件操作失败:", e);
      // 简易错误提示(后续做 toast)
      toast.error(`操作失败: ${e}`);
    }
    setInlineEdit(null);
  };

  // 全部折叠
  const collapseAll = () => {
    useFileTreeStore.setState({ expandedPaths: new Set() });
    recomputeVisible();
  };

  return (
    <div className="filetree" tabIndex={0} onKeyDown={handleKeyDown}>
      {/* 工具栏 */}
      <div className="filetree__header">
        <span className="filetree__title">资源管理器</span>
        <div className="filetree__actions">
          <button
            className="icon-btn"
            title="新建文件"
            onClick={() =>
              rootPath &&
              setInlineEdit({ type: "new-file", parentPath: getNewFileParent(rootPath, selectedPath) })
            }
          >
            <NewFileIcon size={15} />
          </button>
          <button
            className="icon-btn"
            title="新建文件夹"
            onClick={() =>
              rootPath &&
              setInlineEdit({ type: "new-dir", parentPath: getNewFileParent(rootPath, selectedPath) })
            }
          >
            <NewFolderIcon size={15} />
          </button>
          <button className="icon-btn" onClick={refreshTree} title="刷新">
            <RefreshIcon size={15} />
          </button>
          <button className="icon-btn" onClick={collapseAll} title="全部折叠">
            <CollapseAllIcon size={15} />
          </button>
          <button
            className="icon-btn"
            onClick={() => setSortBy(sortBy === "name" ? "modified" : "name")}
            title={`排序: ${sortBy === "name" ? "按名称" : "按修改时间"}`}
          >
            {sortBy === "name" ? "A↓" : "⏱"}
          </button>
        </div>
      </div>

      {/* 项目根 */}
      {rootPath && (
        <div className="filetree__root">{rootPath.split("/").pop() || rootPath}</div>
      )}

      {/* 过滤 */}
      <div className="filetree__filter">
        <input
          type="text"
          placeholder="筛选文件..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      {/* 列表 */}
      <div
        className="filetree__list"
        ref={containerRef}
        onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}
        onContextMenu={(e) => handleContextMenu(e, null)}
      >
        {visibleNodes.length === 0 ? (
          <div className="filetree__empty">
            {rootPath ? "暂无文件" : "尚未打开文件夹"}
          </div>
        ) : (
          <div style={{ height: totalHeight, position: "relative" }}>
            <div style={{ transform: `translateY(${offsetY}px)` }}>
              {slice.map((node) => (
                <TreeRow
                  key={node.path}
                  node={node}
                  selected={selectedPath === node.path}
                  dirty={isDirty(node.path)}
                  gitStatus={getGitStatus(node)}
                  isEditing={
                    inlineEdit?.type === "rename" &&
                    inlineEdit.node.path === node.path
                  }
                  onClick={() => handleClick(node)}
                  onDoubleClick={() => handleDoubleClick(node)}
                  onContextMenu={(e) => handleContextMenu(e, node)}
                  onRename={(v) => handleInlineConfirm(v)}
                  onCancelEdit={() => setInlineEdit(null)}
                />
              ))}
            </div>
          </div>
        )}

        {/* 内联新建: 在列表底部追加一行 */}
        {inlineEdit && (inlineEdit.type === "new-file" || inlineEdit.type === "new-dir") && (
          <div
            className="tree-row"
            style={{
              paddingLeft: 8 + getInlineDepth(rootPath!, inlineEdit.parentPath) * 12,
            }}
          >
            <span className="tree-row__chevron" />
            <span className="tree-row__icon">
              <FileIcon type={inlineEdit.type === "new-dir" ? "folder" : "file"} size={16} />
            </span>
            <InlineInput
              initialValue=""
              onConfirm={handleInlineConfirm}
              onCancel={() => setInlineEdit(null)}
            />
          </div>
        )}
      </div>

      {/* 右键菜单 */}
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={buildMenuItems(
            menu.node,
            rootPath,
            setInlineEdit,
            setConfirmDelete,
            setSelected
          )}
        />
      )}

      {/* 删除确认 */}
      <ConfirmDialog
        open={confirmDelete !== null}
        title={confirmDelete ? `删除${confirmDelete.isDir ? "文件夹" : "文件"}` : ""}
        message={
          confirmDelete
            ? `确定要删除 "${confirmDelete.name}" 吗？\n${
                confirmDelete.isDir
                  ? "该操作将递归删除文件夹内所有内容，且不可恢复。"
                  : "此操作不可恢复。"
              }`
            : ""
        }
        confirmLabel="删除"
        danger
        onConfirm={async () => {
          if (!confirmDelete) return;
          try {
            await deletePath(confirmDelete.path);
          } catch (e) {
            toast.error(`删除失败: ${e}`);
          }
          setConfirmDelete(null);
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

function TreeRow({
  node,
  selected,
  dirty,
  gitStatus,
  isEditing,
  onClick,
  onDoubleClick,
  onContextMenu,
  onRename,
  onCancelEdit,
}: {
  node: VisibleNode;
  selected: boolean;
  dirty: boolean;
  gitStatus: FileStatus | null;
  isEditing: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onRename: (v: string) => void;
  onCancelEdit: () => void;
}) {
  const iconType = getFileIconType(node.name, node.isDir);
  const paddingLeft = 8 + node.depth * 12;

  // Git 着色: 选中态不染色(用选中背景), 文件名按状态上色
  const gitClass = !selected && gitStatus ? `tree-row--git-${gitStatus}` : "";
  // 状态字母(M/U/A/D 等), 仅文件显示, 目录不显示字母
  const statusLetter: Record<FileStatus, string> = {
    modified: "M",
    added: "A",
    deleted: "D",
    renamed: "R",
    untracked: "U",
    conflict: "C",
  };

  return (
    <div
      className={`tree-row ${selected ? "tree-row--selected" : ""} ${gitClass}`}
      style={{ height: ITEM_HEIGHT, paddingLeft }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      title={node.path}
    >
      <span className="tree-row__chevron">
        {node.isDir ? (
          node.expanded ? (
            <ChevronDown />
          ) : (
            <ChevronRight />
          )
        ) : null}
      </span>
      <span className="tree-row__icon">
        <FileIcon type={iconType} isFolderOpen={node.expanded} size={16} />
      </span>
      {isEditing ? (
        <InlineInput
          initialValue={node.name}
          onConfirm={onRename}
          onCancel={onCancelEdit}
        />
      ) : (
        <>
          <span className="tree-row__name">{node.name}</span>
          {gitStatus && !node.isDir && (
            <span className={`tree-row__git-letter tree-row--git-${gitStatus}`}>
              {statusLetter[gitStatus]}
            </span>
          )}
          {dirty && <span className="tree-row__dirty" />}
        </>
      )}
    </div>
  );
}

/** 计算新建文件应放在哪个目录(选中目录或其父目录或根) */
function getNewFileParent(rootPath: string, selectedPath: string | null): string {
  if (!selectedPath || selectedPath === rootPath) return rootPath;
  const { visibleNodes } = useFileTreeStore.getState();
  const node = visibleNodes.find((n) => n.path === selectedPath);
  if (node?.isDir) return selectedPath;
  // 选中文件 → 用其父目录
  return selectedPath.substring(0, selectedPath.lastIndexOf("/")) || rootPath;
}

/** 内联新建行的缩进深度 */
function getInlineDepth(rootPath: string, parentPath: string): number {
  const rootDepth = rootPath.split("/").length;
  const parentDepth = parentPath.split("/").length;
  return Math.max(0, parentDepth - rootDepth);
}

/** 构建右键菜单项 */
function buildMenuItems(
  node: VisibleNode | null,
  rootPath: string | null,
  setInlineEdit: (e: InlineEdit) => void,
  setConfirmDelete: (n: VisibleNode) => void,
  _setSelected: (p: string | null) => void
): MenuItem[] {
  const items: MenuItem[] = [];

  if (node) {
    if (!node.isDir) {
      items.push({
        id: "open",
        label: "打开",
        onClick: () => {},
      });
    }
    // 文件剪贴板: 复制/剪切
    items.push({
      id: "file-copy",
      label: "复制",
      onClick: () => useClipStore.getState().copy(node.path),
    });
    items.push({
      id: "file-cut",
      label: "剪切",
      onClick: () => useClipStore.getState().cut(node.path),
    });
    items.push({
      id: "copy-path",
      label: "复制路径",
      onClick: () => {
        navigator.clipboard.writeText(node.path);
      },
    });
    items.push({
      id: "copy-relpath",
      label: "复制相对路径",
      onClick: () => {
        if (rootPath) {
          navigator.clipboard.writeText(node.path.replace(rootPath + "/", ""));
        }
      },
    });
    // Git: 查看文件历史 + blame(仅文件 + 仅 git 仓库内)
    if (!node.isDir && useGitStore.getState().repoRoot) {
      items.push({
        id: "file-history",
        label: "查看文件历史",
        onClick: () =>
          useEditorStore.getState().openHistory({
            filePath: node.path,
            fileName: node.name,
          }),
      });
      items.push({
        id: "file-blame",
        label: "查看 Blame",
        onClick: () =>
          useEditorStore.getState().openBlame({
            filePath: node.path,
            fileName: node.name,
          }),
      });
    }
    items.push({ id: "sep1", label: "", separator: true });
    items.push({
      id: "rename",
      label: "重命名 (F2)",
      onClick: () => setInlineEdit({ type: "rename", node }),
    });
    items.push({
      id: "delete",
      label: `删除 (Delete)`,
      danger: true,
      onClick: () => setConfirmDelete(node),
    });
    if (node.isDir) {
      items.push({ id: "sep2", label: "", separator: true });
      items.push({
        id: "new-file-in",
        label: "在此新建文件",
        onClick: () => setInlineEdit({ type: "new-file", parentPath: node.path }),
      });
      items.push({
        id: "new-dir-in",
        label: "在此新建文件夹",
        onClick: () => setInlineEdit({ type: "new-dir", parentPath: node.path }),
      });
    }
  } else {
    // 空白区
    items.push({
      id: "new-file",
      label: "新建文件",
      onClick: () =>
        rootPath &&
        setInlineEdit({ type: "new-file", parentPath: rootPath }),
    });
    items.push({
      id: "new-dir",
      label: "新建文件夹",
      onClick: () =>
        rootPath &&
        setInlineEdit({ type: "new-dir", parentPath: rootPath }),
    });
    // 粘贴(有剪贴板内容时)
    const clip = useClipStore.getState().clipboard;
    if (clip && rootPath) {
      items.push({
        id: "paste",
        label: `粘贴 (${clip.op === "copy" ? "复制" : "剪切"})`,
        onClick: async () => {
          try {
            if (clip.op === "copy") {
              await copyPath(clip.path, rootPath);
            } else {
              await movePath(clip.path, rootPath);
              useClipStore.getState().clear();
            }
          } catch (e) {
            toast.error(`粘贴失败: ${e}`);
          }
        },
      });
    }
    items.push({ id: "sep", label: "", separator: true });
    items.push({
      id: "refresh",
      label: "刷新",
      onClick: () => useFileTreeStore.getState().refreshTree(),
    });
  }
  return items;
}

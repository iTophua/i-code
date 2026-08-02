import { invoke } from "@tauri-apps/api/core";
import { useFileTreeStore } from "../stores/fileTreeStore";

/**
 * 文件操作封装
 * 所有操作成功后自动刷新文件树
 */

/** 新建文件 */
export async function createFile(filePath: string): Promise<void> {
  await invoke("create_file", { filePath });
  await refreshParentAndExpand(filePath);
}

/** 新建文件夹 */
export async function createDir(dirPath: string): Promise<void> {
  await invoke("create_dir", { dirPath });
  await refreshParentAndExpand(dirPath);
}

/** 删除文件/文件夹 */
export async function deletePath(path: string): Promise<void> {
  await invoke("delete_path", { path });
  await useFileTreeStore.getState().refreshTree();
}

/** 重命名 */
export async function renamePath(from: string, to: string): Promise<void> {
  await invoke("rename_path", { from, to });
  await useFileTreeStore.getState().refreshTree();
}

/** 路径是否存在 */
export async function pathExists(path: string): Promise<boolean> {
  return invoke<boolean>("path_exists", { path });
}

/** 复制文件/目录到目标目录 */
export async function copyPath(src: string, destDir: string): Promise<void> {
  const name = src.split("/").pop() || src;
  const dest = `${destDir}/${name}`;
  // 用 Rust 的 copy_dir 或 fallback
  await invoke("copy_path", { src, dest });
  await useFileTreeStore.getState().refreshTree();
}

/** 移动文件/目录(剪切的粘贴) */
export async function movePath(src: string, destDir: string): Promise<void> {
  const name = src.split("/").pop() || src;
  const dest = `${destDir}/${name}`;
  await invoke("rename_path", { from: src, to: dest });
  await useFileTreeStore.getState().refreshTree();
}

/**
 * 操作后刷新: 刷新整棵树, 并展开新文件的父目录
 * (简单实现: 直接刷新全树, 已展开的目录会被 reloadExpanded 重新加载)
 */
async function refreshParentAndExpand(newPath: string): Promise<void> {
  // 确保父目录在展开集合里
  const { expandedPaths } = useFileTreeStore.getState();
  const parentPath = newPath.substring(0, newPath.lastIndexOf("/"));
  if (parentPath && !expandedPaths.has(parentPath)) {
    expandedPaths.add(parentPath);
  }
  await useFileTreeStore.getState().refreshTree();
}

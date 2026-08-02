import type { TabKind } from "../stores/editorStore";
import type { SidebarView } from "../stores/layoutStore";

/**
 * 侧栏菜单 → 编辑区只显示对应功能的 Tab
 *
 * 设计: 每个"菜单域"有独立的 tab 视图, 切换菜单即切换 tab 域,
 * 互不混淆(资源管理器看文件 tab, 便签看便签 tab, 工具看工具 tab)。
 *
 * 文件相关 tab(file/diff/history/blame/log/merge)归资源管理器/搜索/Git 域。
 */
const SCOPE_FILE: TabKind[] = ["file", "diff", "history", "blame", "log", "merge", "image"];

/** 某侧栏视图下, 允许显示的 tab kind 列表 */
export function allowedKinds(view: SidebarView): TabKind[] {
  switch (view) {
    case "notes":
      return ["note"];
    case "tools":
      return ["tool"];
    // explorer / search / git 都属于文件域
    default:
      return SCOPE_FILE;
  }
}

/** 判断某 tab kind 是否属于当前侧栏视图的 tab 域 */
export function tabInScope(kind: TabKind, view: SidebarView): boolean {
  return allowedKinds(view).includes(kind);
}

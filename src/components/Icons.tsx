/**
 * 图标统一导出 — 基于 lucide-react
 * 统一在调用处传 strokeWidth={1.5} 控制粗细
 */
export {
  Files as FilesIcon,
  Search as SearchIcon,
  GitBranch as GitIcon,
  StickyNote as NotesIcon,
  Wrench as ToolsIcon,
  SquareTerminal as TerminalIcon,
  X as CloseIcon,
  Check,
  Save as SaveIcon,
  Columns2 as SplitViewIcon,
  Eye as PreviewOnlyIcon,
  Code as CodeOnlyIcon,
  ChevronRight,
  ChevronDown,
  FolderOpen as FolderOpenIcon,
  FilePlus as NewFileIcon,
  FolderPlus as NewFolderIcon,
  RefreshCw as RefreshIcon,
  ChevronsDownUp as CollapseAllIcon,
} from "lucide-react";

export interface IconProps {
  size?: number;
  className?: string;
}

import { useRef } from "react";
import { useLayoutStore, type SidebarView } from "../stores/layoutStore";
import {
  FilesIcon,
  SearchIcon,
  GitIcon,
  NotesIcon,
  ToolsIcon,
} from "./Icons";
import { TerminalSquare, AlertCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useNotesStore } from "../stores/notesStore";
import { useEditorStore } from "../stores/editorStore";
import "../styles/activitybar.css";

interface ActivityItem {
  id: SidebarView;
  label: string;
  icon: LucideIcon;
}

// 文件操作类(资源管理器/搜索/Git)
const FILE_ITEMS: ActivityItem[] = [
  { id: "explorer", label: "资源管理器", icon: FilesIcon },
  { id: "search", label: "搜索", icon: SearchIcon },
  { id: "git", label: "源代码管理 (Git)", icon: GitIcon },
];
// 辅助功能类(便签/工具) — 与文件操作区分组显示
const AUX_ITEMS: ActivityItem[] = [
  { id: "notes", label: "便签", icon: NotesIcon },
  { id: "tools", label: "工具", icon: ToolsIcon },
];

export function ActivityBar() {
  const { sidebarView, sidebarVisible, setSidebarView } = useLayoutStore();
  const workspaceRoot = useLayoutStore((s) => s.workspaceRoot);
  // 单击/双击区分: 记录点击次数, 250ms 内两次点击 = 双击(不触发单击的切栏)
  const clickCountRef = useRef(0);
  const clickTimerRef = useRef<number | null>(null);

  // 便签: 双击活动栏图标 → 新建便签并打开
  const createAndOpenNote = async () => {
    await useNotesStore.getState().createNote(workspaceRoot);
    const latest = useNotesStore.getState().notes[0];
    if (latest) {
      useEditorStore.getState().openNote({
        id: latest.id,
        title: latest.title,
        content: latest.content,
        language: latest.language,
      });
    }
  };

  // 便签图标的点击处理(区分单击切栏 / 双击新建)
  const handleNotesClick = () => {
    clickCountRef.current += 1;
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    if (clickCountRef.current === 1) {
      clickTimerRef.current = window.setTimeout(() => {
        // 单击: 切换侧栏
        setSidebarView("notes");
        clickCountRef.current = 0;
      }, 250);
    } else {
      // 双击: 新建便签
      clickCountRef.current = 0;
      createAndOpenNote();
    }
  };

  // 渲染单个活动栏按钮
  const renderItem = (item: ActivityItem) => {
    const Icon = item.icon;
    const isActive = sidebarView === item.id && sidebarVisible;
    return (
      <button
        key={item.id}
        className={`activity-item ${isActive ? "activity-item--active" : ""}`}
        title={item.label}
        onClick={item.id === "notes" ? handleNotesClick : () => setSidebarView(item.id)}
      >
        <Icon size={20} />
      </button>
    );
  };

  return (
    <div className="activity-bar">
      {FILE_ITEMS.map(renderItem)}
      {/* 分组分隔: 文件操作类 与 便签/工具 等辅助功能分开 */}
      <div className="activity-bar__divider" />
      {AUX_ITEMS.map(renderItem)}

      <div className="activity-bar__spacer" />
      <button
        className={`activity-item ${useLayoutStore.getState().panelVisible && useLayoutStore.getState().panelView === "problems" ? "activity-item--active" : ""}`}
        title="问题"
        onClick={() => {
          const st = useLayoutStore.getState();
          // 已显示且当前是 problems → 隐藏; 否则切到 problems 并显示
          if (st.panelVisible && st.panelView === "problems") st.togglePanel();
          else st.setPanelView("problems");
        }}
      >
        <AlertCircle size={20} strokeWidth={1.5} />
      </button>
      <button
        className={`activity-item ${useLayoutStore.getState().panelVisible && useLayoutStore.getState().panelView === "terminal" ? "activity-item--active" : ""}`}
        title="终端 (Ctrl+`)"
        onClick={() => {
          const st = useLayoutStore.getState();
          if (st.panelVisible && st.panelView === "terminal") st.togglePanel();
          else st.setPanelView("terminal");
        }}
      >
        <TerminalSquare size={20} strokeWidth={1.5} />
      </button>
    </div>
  );
}

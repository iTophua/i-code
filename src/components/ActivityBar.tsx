import { useLayoutStore, type SidebarView } from "../stores/layoutStore";
import {
  FilesIcon,
  SearchIcon,
  GitIcon,
  NotesIcon,
  ToolsIcon,
} from "./Icons";
import { Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useNotesStore } from "../stores/notesStore";
import { useEditorStore } from "../stores/editorStore";
import "../styles/activitybar.css";

interface ActivityItem {
  id: SidebarView;
  label: string;
  icon: LucideIcon;
}

const ITEMS: ActivityItem[] = [
  { id: "explorer", label: "资源管理器", icon: FilesIcon },
  { id: "search", label: "搜索", icon: SearchIcon },
  { id: "git", label: "源代码管理 (Git)", icon: GitIcon },
  { id: "notes", label: "便签", icon: NotesIcon },
  { id: "tools", label: "工具", icon: ToolsIcon },
];

export function ActivityBar() {
  const { sidebarView, sidebarVisible, setSidebarView } = useLayoutStore();
  const workspaceRoot = useLayoutStore((s) => s.workspaceRoot);

  // 便签: 双击活动栏图标 → 新建便签并打开
  const handleNotesDoubleClick = async () => {
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

  return (
    <div className="activity-bar">
      {ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = sidebarView === item.id && sidebarVisible;
        return (
          <button
            key={item.id}
            className={`activity-item ${isActive ? "activity-item--active" : ""}`}
            title={item.label}
            onClick={() => setSidebarView(item.id)}
            onDoubleClick={item.id === "notes" ? handleNotesDoubleClick : undefined}
          >
            <Icon size={20} />
          </button>
        );
      })}

      <div className="activity-bar__spacer" />
      <button
        className={`activity-item ${sidebarView === "settings" && sidebarVisible ? "activity-item--active" : ""}`}
        title="设置"
        onClick={() => setSidebarView("settings")}
      >
        <Settings size={20} strokeWidth={1.5} />
      </button>
    </div>
  );
}

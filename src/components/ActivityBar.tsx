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

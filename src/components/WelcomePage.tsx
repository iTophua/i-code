import { useEffect, useState } from "react";
import { useLayoutStore } from "../stores/layoutStore";
import { getRecentProjects, removeRecentProject, type RecentProject } from "../utils/recentProjects";
import { switchProject, openFolderDialog } from "../utils/project";
import { FolderOpen, Clock, FileText } from "lucide-react";
import "../styles/welcome.css";

export function WelcomePage() {
  const setSidebarView = useLayoutStore((s) => s.setSidebarView);
  const [recent, setRecent] = useState<RecentProject[]>([]);

  useEffect(() => {
    getRecentProjects().then(setRecent);
  }, []);

  const openFolder = async () => {
    try {
      const selected = await openFolderDialog();
      if (selected) getRecentProjects().then(setRecent);
    } catch (e) {
      console.error(e);
    }
  };

  const openRecent = async (path: string) => {
    await switchProject(path);
  };

  const removeRecent = async (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = await removeRecentProject(path);
    setRecent(updated);
  };

  return (
    <div className="welcome">
      <div className="welcome__logo">iCode</div>

      <div className="welcome__section">
        <div className="welcome__section-title">开始</div>
        <div className="welcome__actions">
          <button className="welcome__action" onClick={openFolder}>
            <FolderOpen size={20} strokeWidth={1.5} />
            <span>打开文件夹</span>
          </button>
          <button className="welcome__action" onClick={() => setSidebarView("notes")}>
            <FileText size={20} strokeWidth={1.5} />
            <span>新建便签</span>
          </button>
        </div>
      </div>

      {recent.length > 0 && (
        <div className="welcome__section">
          <div className="welcome__section-title">
            <Clock size={14} strokeWidth={1.5} /> 最近打开
          </div>
          <div className="welcome__recent">
            {recent.map((p) => (
              <div key={p.path} className="welcome__recent-item" onClick={() => openRecent(p.path)}>
                <FolderOpen size={16} strokeWidth={1.5} className="welcome__recent-icon" />
                <div className="welcome__recent-info">
                  <span className="welcome__recent-name">{p.name}</span>
                  <span className="welcome__recent-path">{p.path}</span>
                </div>
                <span className="welcome__recent-time">{formatTime(p.openedAt)}</span>
                <button
                  className="welcome__recent-remove"
                  onClick={(e) => removeRecent(p.path, e)}
                  title="移除"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return "刚刚";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

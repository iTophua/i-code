import { useEffect, useRef, useState } from "react";
import { useLayoutStore } from "../stores/layoutStore";
import { useGitStore } from "../stores/gitStore";
import { Settings, CircleHelp, Folder, ChevronDown, FolderOpen, X, Plus } from "lucide-react";
import { getRecentProjects, removeRecentProject, type RecentProject } from "../utils/recentProjects";
import { switchProject, closeProject, openFolderDialog } from "../utils/project";
import "../styles/titlebar.css";

export function TitleBar() {
  const { branch, changes } = useGitStore();
  const workspaceRoot = useLayoutStore((s) => s.workspaceRoot);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const projectWrapRef = useRef<HTMLDivElement>(null);

  // 项目名(路径最后一段), 无项目时为空
  const projectName = workspaceRoot ? workspaceRoot.split("/").pop() || workspaceRoot : "";

  // 点切换器外部关闭下拉(用 mousedown 避免与按钮 onClick 冲突)
  useEffect(() => {
    if (!dropdownOpen) return;
    const onDown = (e: MouseEvent) => {
      if (projectWrapRef.current && !projectWrapRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [dropdownOpen]);

  // 项目被外部入口(命令面板/快捷键/欢迎页)切换 → 关闭下拉, 避免列表/当前标记陈旧
  useEffect(() => {
    setDropdownOpen(false);
  }, [workspaceRoot]);

  return (
    <div className="titlebar" data-tauri-drag-region>
      <div className="titlebar__traffic" />
      {/* 项目切换器(红绿灯正右侧, 左对齐) */}
      <div className="titlebar__project-wrap" ref={projectWrapRef}>
        <button
          className="titlebar__project"
          onClick={() => setDropdownOpen((o) => !o)}
          title={workspaceRoot ?? "打开项目"}
        >
          <Folder size={13} strokeWidth={1.5} />
          <span className="titlebar__project-name">
            {projectName || "打开文件夹"}
          </span>
          <ChevronDown size={12} strokeWidth={1.5} className="titlebar__project-chev" />
        </button>
        {dropdownOpen && (
          <ProjectDropdown
            currentRoot={workspaceRoot}
            onClose={() => setDropdownOpen(false)}
          />
        )}
      </div>
      <div className="titlebar__center" data-tauri-drag-region>
        {branch && (
          <span className="titlebar__branch" data-tauri-drag-region>
            ⎇ {branch}
            {changes.length > 0 && (
              <span className="titlebar__branch-count" data-tauri-drag-region>
                {changes.length}
              </span>
            )}
          </span>
        )}
      </div>
      <div className="titlebar__actions">
        <button
          className="titlebar__btn"
          onClick={() => useLayoutStore.getState().setHelpOpen(true)}
          title="使用帮助"
        >
          <CircleHelp size={15} strokeWidth={1.5} />
        </button>
        <button
          className={`titlebar__btn ${useLayoutStore.getState().settingsOpen ? "titlebar__btn--active" : ""}`}
          onClick={() => useLayoutStore.getState().setSettingsOpen(true)}
          title="设置 (Cmd+,)"
        >
          <Settings size={15} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}

/**
 * 项目下拉:最近项目列表 + 打开文件夹 + 关闭项目
 */
function ProjectDropdown({
  currentRoot,
  onClose,
}: {
  currentRoot: string | null;
  onClose: () => void;
}) {
  const [recent, setRecent] = useState<RecentProject[]>([]);
  const [switching, setSwitching] = useState<string | null>(null);

  useEffect(() => {
    getRecentProjects().then(setRecent);
  }, []);

  const handleSwitch = async (path: string) => {
    if (path === currentRoot) {
      onClose();
      return;
    }
    setSwitching(path);
    try {
      await switchProject(path);
      onClose();
    } finally {
      setSwitching(null);
    }
  };

  const handleOpen = async () => {
    setSwitching("__open__");
    try {
      await openFolderDialog();
      onClose();
    } finally {
      setSwitching(null);
    }
  };

  const handleClose = async () => {
    setSwitching("__close__");
    try {
      await closeProject();
      onClose();
    } finally {
      setSwitching(null);
    }
  };

  const handleRemove = async (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = await removeRecentProject(path);
    setRecent(updated);
  };

  return (
    <div className="project-dropdown">
      <div className="project-dropdown__list">
        {recent.length === 0 ? (
          <div className="project-dropdown__empty">暂无最近项目</div>
        ) : (
          recent.map((p) => {
            const isCurrent = p.path === currentRoot;
            const isLoading = switching === p.path;
            return (
              <button
                key={p.path}
                className={`project-dropdown__item ${isCurrent ? "project-dropdown__item--current" : ""}`}
                onClick={() => handleSwitch(p.path)}
                disabled={isLoading}
                title={p.path}
              >
                <FolderOpen size={14} strokeWidth={1.5} className="project-dropdown__icon" />
                <span className="project-dropdown__info">
                  <span className="project-dropdown__name">{p.name}</span>
                  <span className="project-dropdown__path">{p.path}</span>
                </span>
                {isCurrent && <span className="project-dropdown__cur">当前</span>}
                {!isCurrent && (
                  <span
                    className="project-dropdown__remove"
                    onClick={(e) => handleRemove(p.path, e)}
                    title="从列表移除"
                  >
                    <X size={12} />
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>
      <div className="project-dropdown__sep" />
      <button
        className="project-dropdown__action"
        onClick={handleOpen}
        disabled={switching === "__open__"}
      >
        <Plus size={14} strokeWidth={1.5} />
        <span>打开文件夹...</span>
        <span className="project-dropdown__shortcut">⌘O</span>
      </button>
      {currentRoot && (
        <button
          className="project-dropdown__action project-dropdown__action--danger"
          onClick={handleClose}
          disabled={switching === "__close__"}
        >
          <X size={14} strokeWidth={1.5} />
          <span>关闭项目</span>
        </button>
      )}
    </div>
  );
}

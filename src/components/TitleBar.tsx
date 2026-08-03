import { useEffect, useRef, useState } from "react";
import { useLayoutStore } from "../stores/layoutStore";
import { useGitStore } from "../stores/gitStore";
import { Settings, CircleHelp, Folder, ChevronDown, FolderOpen, X, Plus } from "lucide-react";
import { getRecentProjects, removeRecentProject, type RecentProject } from "../utils/recentProjects";
import { switchProject, closeProject, openFolderDialog } from "../utils/project";
import { BranchSwitcher } from "./BranchSwitcher";
import "../styles/titlebar.css";

export function TitleBar() {
  const changes = useGitStore((s) => s.changes);
  const workspaceRoot = useLayoutStore((s) => s.workspaceRoot);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const projectWrapRef = useRef<HTMLDivElement>(null);

  // 项目名(路径最后一段), 无项目时为空
  const projectName = workspaceRoot ? workspaceRoot.split("/").pop() || workspaceRoot : "";

  // 点切换器外部关闭下拉
  // 用 click 而非 mousedown:Tauri 的 data-tauri-drag-region 在原生层拦截 mousedown
  // 启动窗口拖拽, 导致标题栏空白区的 mousedown 不派发到 JS → 下拉不收起。
  // click 在 mouseup 后触发, drag-region 不拦截, 能正常收到。
  // 下拉项用 onMouseDown 触发(stopPropagation), 避免先关闭再点击的竞态。
  useEffect(() => {
    if (!dropdownOpen) return;
    const onClick = (e: MouseEvent) => {
      if (projectWrapRef.current && !projectWrapRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    // 延迟绑定:避免本次打开下拉的 click 冒泡到 document 立即关闭
    const id = window.setTimeout(() => {
      document.addEventListener("click", onClick);
    }, 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("click", onClick);
    };
  }, [dropdownOpen]);

  // 项目被外部入口(命令面板/快捷键/欢迎页)切换 → 关闭下拉, 避免列表/当前标记陈旧
  useEffect(() => {
    setDropdownOpen(false);
  }, [workspaceRoot]);

  return (
    <div className="titlebar" data-tauri-drag-region>
      <div className="titlebar__traffic" />
      {/* 项目切换器(红绿灯正右侧) + 分支徽章(紧跟项目右侧) */}
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
        {/* 分支切换器(项目切换器右侧, 可点开下拉切换/新建分支) */}
        <BranchSwitcher />
        {/* 改动数徽章(紧跟分支, >0 时显示) */}
        {changes.length > 0 && (
          <span className="titlebar__changes-count" title={`${changes.length} 个改动`}>
            {changes.length}
          </span>
        )}
        {dropdownOpen && (
          <ProjectDropdown
            currentRoot={workspaceRoot}
            onClose={() => setDropdownOpen(false)}
          />
        )}
      </div>
      {/* 弹性占位(把项目+分支推到左侧) */}
      <div className="titlebar__center" data-tauri-drag-region />
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

import { useLayoutStore } from "../stores/layoutStore";
import { useGitStore } from "../stores/gitStore";
import { TerminalIcon } from "./Icons";
import "../styles/titlebar.css";

export function TitleBar() {
  const { panelVisible, togglePanel, toggleSidebar } = useLayoutStore();
  const { branch, changes } = useGitStore();

  return (
    <div className="titlebar" data-tauri-drag-region>
      <div className="titlebar__traffic" />
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
          onClick={toggleSidebar}
          title="切换侧栏 (Cmd+B)"
        >
          ☰
        </button>
        <button
          className={`titlebar__btn ${panelVisible ? "titlebar__btn--active" : ""}`}
          onClick={togglePanel}
          title="终端 (Ctrl+`)"
        >
          <TerminalIcon size={15} />
        </button>
      </div>
    </div>
  );
}

import { useLayoutStore } from "../stores/layoutStore";
import { useGitStore } from "../stores/gitStore";
import { Settings, CircleHelp } from "lucide-react";
import "../styles/titlebar.css";

export function TitleBar() {
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

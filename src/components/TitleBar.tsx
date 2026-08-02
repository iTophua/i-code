import { useLayoutStore } from "../stores/layoutStore";
import { useGitStore } from "../stores/gitStore";
import { Settings, CircleHelp } from "lucide-react";
import { toast } from "../stores/toastStore";
import "../styles/titlebar.css";

/** 快捷键帮助文本 */
const SHORTCUTS = `快捷键:
Cmd+O        打开文件夹
Cmd+W        关闭标签
Cmd+Shift+T  恢复关闭的标签
Cmd+B        切换侧栏
Cmd+Shift+P  命令面板
Cmd+Shift+F  全局搜索
Cmd+,        设置
Cmd+\        分屏
Cmd+D        下一个匹配项
Cmd+Shift+L  所有匹配项
Cmd+点击     加光标
Option+拖拽  列选
Ctrl+\`       终端`;

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
          onClick={() => toast.info(SHORTCUTS)}
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

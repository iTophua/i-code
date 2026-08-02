import { useEffect, useRef } from "react";
import { useTerminalStore } from "../stores/terminalStore";
import { useLayoutStore } from "../stores/layoutStore";
import { TerminalView } from "./TerminalView";
import { TerminalIcon, CloseIcon } from "./Icons";
import "../styles/panel.css";

export function TerminalPanel() {
  const { tabs, activeId, createTerminal, closeTerminal, setActive } =
    useTerminalStore();
  const workspaceRoot = useLayoutStore((s) => s.workspaceRoot);
  const initRef = useRef(false);

  // 面板首次显示且无终端时自动建一个
  // 用 ref 防止 StrictMode 双调用导致建两个终端
  useEffect(() => {
    if (!initRef.current && tabs.length === 0) {
      initRef.current = true;
      createTerminal(workspaceRoot);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="terminal-panel">
      {/* 标签栏 */}
      <div className="panel__tabs">
        <div className="panel__tabs-list">
          {tabs.map((t) => (
            <div
              key={t.id}
              className={`panel-tab ${t.id === activeId ? "panel-tab--active" : ""}`}
              onClick={() => setActive(t.id)}
            >
              <TerminalIcon size={13} />
              <span className="panel-tab__name">{t.title}</span>
              <button
                className="panel-tab__close"
                onClick={(e) => {
                  e.stopPropagation();
                  closeTerminal(t.id);
                }}
              >
                <CloseIcon size={12} />
              </button>
            </div>
          ))}
        </div>
        <button
          className="panel__new-btn"
          title="新建终端"
          onClick={() => createTerminal(workspaceRoot)}
        >
          +
        </button>
      </div>

      {/* 终端视图区 */}
      <div className="panel__body">
        {tabs.length === 0 ? (
          <div className="panel__empty">点击 + 新建终端</div>
        ) : (
          tabs.map((t) => (
            <TerminalView key={t.id} termId={t.id} active={t.id === activeId} />
          ))
        )}
      </div>
    </div>
  );
}

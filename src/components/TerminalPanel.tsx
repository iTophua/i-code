import { useEffect, useRef, useCallback } from "react";
import { useTerminalStore } from "../stores/terminalStore";
import { useLayoutStore } from "../stores/layoutStore";
import { TerminalView } from "./TerminalView";
import { TerminalIcon, CloseIcon } from "./Icons";
import { X } from "lucide-react";
import "../styles/panel.css";

export function TerminalPanel() {
  const { tabs, activeId, createTerminal, closeTerminal, setActive } =
    useTerminalStore();
  const workspaceRoot = useLayoutStore((s) => s.workspaceRoot);
  const panelVisible = useLayoutStore((s) => s.panelVisible);
  const panelView = useLayoutStore((s) => s.panelView);
  const togglePanel = useLayoutStore((s) => s.togglePanel);
  const initRef = useRef(false);

  // 面板切到终端视图 + 首次显示且无终端时自动建一个
  // 用 ref 防止 StrictMode 双调用导致建两个终端
  useEffect(() => {
    const root = useLayoutStore.getState().workspaceRoot;
    if (!initRef.current && tabs.length === 0 && root && panelVisible && panelView === "terminal") {
      initRef.current = true;
      createTerminal(root);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceRoot, panelVisible, panelView]);

  // 关闭最后一个终端 tab → 自动收起面板
  useEffect(() => {
    if (tabs.length === 0 && panelVisible && panelView === "terminal") {
      // 延迟收起,避免和 closeTerminal 的 setState 批处理冲突
      const id = setTimeout(() => {
        if (useTerminalStore.getState().tabs.length === 0) {
          useLayoutStore.getState().togglePanel();
        }
      }, 0);
      return () => clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs.length]);

  // 下次打开面板时如果没有终端 → 自动建一个
  useEffect(() => {
    if (panelVisible && panelView === "terminal" && tabs.length === 0) {
      const root = useLayoutStore.getState().workspaceRoot;
      if (root) createTerminal(root);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelVisible, panelView]);

  // 面板顶部拖拽调整高度
  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = useLayoutStore.getState().panelHeight;
    const onMove = (ev: MouseEvent) => {
      // 往上拖(dy<0)→ 增高;往下拖(dy>0)→ 降低
      const dy = ev.clientY - startY;
      const h = Math.min(700, Math.max(120, startH - dy));
      useLayoutStore.getState().setPanelHeight(h);
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.cursor = "row-resize";
  }, []);

  return (
    <div className="terminal-panel">
      {/* 拖拽调整高度的把手 */}
      <div className="panel__resizer" onMouseDown={onResizeStart} title="拖动调整高度" />

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
          onClick={() => createTerminal(useLayoutStore.getState().workspaceRoot)}
        >
          +
        </button>
        {/* 关闭面板按钮 */}
        <button
          className="panel__close-btn"
          title="关闭面板"
          onClick={togglePanel}
        >
          <X size={15} />
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

import { useEffect, useRef } from "react";
import { useTerminalStore } from "../stores/terminalStore";
import { useLayoutStore } from "../stores/layoutStore";
import { TerminalView } from "./TerminalView";
import { TerminalIcon, CloseIcon } from "./Icons";
import { X } from "lucide-react";
import "../styles/panel.css";

export function TerminalPanel() {
  const { tabs, activeId, createTerminal, closeTerminal, setActive } =
    useTerminalStore();
  const panelVisible = useLayoutStore((s) => s.panelVisible);
  const panelView = useLayoutStore((s) => s.panelView);
  const togglePanel = useLayoutStore((s) => s.togglePanel);
  // 防并发创建终端(StrictMode 双调用 / 多 effect 同时触发)
  const creatingRef = useRef(false);
  // 记录面板上一次的可见状态:仅"隐藏→显示"时才自动建终端,
  // 避免"关闭最后一个 tab → tabs=0"误触发创建(与收起面板冲突)
  const wasVisibleRef = useRef(false);

  // 面板从隐藏→显示 且 无终端 → 自动建一个
  useEffect(() => {
    // 只在面板"刚打开"的瞬间触发,不在 tabs 变化时触发
    if (!panelVisible || panelView !== "terminal") {
      wasVisibleRef.current = false;
      return;
    }
    if (!wasVisibleRef.current) {
      wasVisibleRef.current = true;
      // 面板刚打开:如果没有终端则创建一个
      if (tabs.length === 0 && !creatingRef.current) {
        const root = useLayoutStore.getState().workspaceRoot;
        if (root) {
          creatingRef.current = true;
          createTerminal(root).finally(() => {
            creatingRef.current = false;
          });
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelVisible, panelView]);

  // 关闭最后一个终端 tab → 自动收起面板
  useEffect(() => {
    if (tabs.length === 0 && panelVisible && panelView === "terminal") {
      // 此时 panelVisible 还是 true(尚未收起),且 tabs=0
      // 不会触发上面的创建 effect(上面只在 panelVisible 变化时跑)
      useLayoutStore.getState().togglePanel();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs.length]);

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

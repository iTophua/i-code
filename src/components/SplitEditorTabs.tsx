import { useEditorStore } from "../stores/editorStore";
import { useSettingsStore } from "../stores/settingsStore";
import { useLayoutStore } from "../stores/layoutStore";
import { tabInScope } from "../utils/tabScope";
import { getFileIconType } from "../utils/language";
import { FileIcon } from "./FileIcon";
import { CloseIcon, NotesIcon } from "./Icons";
import { ArrowLeftFromLine, X } from "lucide-react";
import "../styles/tabs.css";

/**
 * 第二组(分栏)的 Tab 栏
 */
export function SplitEditorTabs() {
  const { splitTabs, splitActiveId, setSplitActive, closeSplitTab, moveFromSplit, toggleSplit } =
    useEditorStore();
  const tabWrap = useSettingsStore((s) => s.tabWrap);
  const sidebarView = useLayoutStore((s) => s.sidebarView);
  // 同样按当前菜单域过滤
  const scopedSplitTabs = splitTabs.filter((t) => tabInScope(t.kind, sidebarView));

  return (
    <div className="tabs-wrap">
      <div className={`tabs ${tabWrap ? "tabs--wrap" : ""}`}>
        {scopedSplitTabs.length === 0 ? (
          <span className="tabs__placeholder">
            右键主区 Tab →「分屏打开」, 或拖入此处
          </span>
        ) : (
          scopedSplitTabs.map((tab) => {
            const isActive = tab.id === splitActiveId;
            const iconType = getFileIconType(tab.name, false);
            return (
              <div
                key={tab.id}
                className={`tab ${isActive ? "tab--active" : ""}`}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(
                    "application/x-tab-id",
                    JSON.stringify({ tabId: tab.id, fromSplit: true })
                  );
                  e.dataTransfer.effectAllowed = "move";
                  e.currentTarget.classList.add("tab--dragging");
                }}
                onDragEnd={(e) => {
                  e.currentTarget.classList.remove("tab--dragging");
                }}
                onClick={() => setSplitActive(tab.id)}
                onAuxClick={(e) => {
                  if (e.button === 1) {
                    e.preventDefault();
                    closeSplitTab(tab.id);
                  }
                }}
                title={tab.path}
              >
                <span className="tab__icon">
                  {tab.kind === "note" ? (
                    <NotesIcon size={15} />
                  ) : (
                    <FileIcon type={iconType} size={16} />
                  )}
                </span>
                <span className="tab__name">{tab.name}</span>
                <button
                  className="tab__close"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeSplitTab(tab.id);
                  }}
                >
                  <CloseIcon size={14} />
                </button>
              </div>
            );
          })
        )}
      </div>
      {/* 移回第一组 */}
      {splitActiveId && (
        <button
          className="tabs__md-toggle"
          onClick={() => moveFromSplit(splitActiveId)}
          title="移到主编辑器"
        >
          <ArrowLeftFromLine size={14} />
        </button>
      )}
      {/* 关闭整个分栏 */}
      <button
        className="tabs__md-toggle"
        onClick={() => toggleSplit()}
        title="关闭分屏"
      >
        <X size={14} />
      </button>
    </div>
  );
}

import { useEditorStore } from "../stores/editorStore";
import { getFileIconType } from "../utils/language";
import { FileIcon } from "./FileIcon";
import { CloseIcon, NotesIcon } from "./Icons";
import { ArrowLeftFromLine } from "lucide-react";
import "../styles/tabs.css";

/**
 * 第二组(分栏)的 Tab 栏
 */
export function SplitEditorTabs() {
  const { splitTabs, splitActiveId, setSplitActive, closeSplitTab, moveFromSplit } =
    useEditorStore();

  if (splitTabs.length === 0) {
    return (
      <div className="tabs-wrap">
        <div className="tabs" style={{ height: 35 }}>
          <span style={{ padding: "0 12px", alignSelf: "center", color: "var(--fg-muted)", fontSize: 12 }}>
            将 Tab 拖到此处或点击 ‹ 打开到分栏
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="tabs-wrap">
      <div className="tabs">
        {splitTabs.map((tab) => {
          const isActive = tab.id === splitActiveId;
          const iconType = getFileIconType(tab.name, false);
          return (
            <div
              key={tab.id}
              className={`tab ${isActive ? "tab--active" : ""}`}
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
        })}
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
    </div>
  );
}

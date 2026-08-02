import { useEditorStore } from "../stores/editorStore";
import { useLayoutStore } from "../stores/layoutStore";
import { getFileIconType } from "../utils/language";
import { FileIcon } from "./FileIcon";
import { CloseIcon, NotesIcon, SplitViewIcon, PreviewOnlyIcon, CodeOnlyIcon } from "./Icons";
import "../styles/tabs.css";

export function EditorTabs() {
  const { tabs, activeTabId, setActiveTab, closeTab } = useEditorStore();
  const { mdView, cycleMdView } = useLayoutStore();

  if (tabs.length === 0) return null;

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const showMdToggle = activeTab?.language === "markdown";

  const handleClose = (id: string, name: string, isDirty: boolean) => {
    if (isDirty) {
      window.dispatchEvent(
        new CustomEvent("tab-close-request", { detail: { id, name } })
      );
    } else {
      closeTab(id);
    }
  };

  return (
    <div className="tabs-wrap">
      <div className="tabs">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const iconType = getFileIconType(tab.name, false);
          return (
            <div
              key={tab.id}
              className={`tab ${isActive ? "tab--active" : ""} ${
                tab.isPreview ? "tab--preview" : ""
              }`}
              onClick={() => setActiveTab(tab.id)}
              onAuxClick={(e) => {
                if (e.button === 1) {
                  e.preventDefault();
                  handleClose(tab.id, tab.name, tab.isDirty);
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
              <span
                className={`tab__dirty ${tab.isDirty ? "tab__dirty--show" : ""}`}
              />
              <button
                className="tab__close"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClose(tab.id, tab.name, tab.isDirty);
                }}
              >
                <CloseIcon size={14} />
              </button>
            </div>
          );
        })}
      </div>
      {showMdToggle && (
        <button
          className="tabs__md-toggle"
          onClick={cycleMdView}
          title={`视图: ${mdView === "split" ? "分屏" : mdView === "preview" ? "仅预览" : "仅源码"} (Cmd+Shift+V 切换)`}
        >
          {mdView === "split" ? (
            <SplitViewIcon size={16} />
          ) : mdView === "preview" ? (
            <PreviewOnlyIcon size={16} />
          ) : (
            <CodeOnlyIcon size={16} />
          )}
        </button>
      )}
    </div>
  );
}

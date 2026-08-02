import { useState } from "react";
import { useEditorStore } from "../stores/editorStore";
import { useLayoutStore } from "../stores/layoutStore";
import { getFileIconType } from "../utils/language";
import { FileIcon } from "./FileIcon";
import { CloseIcon, NotesIcon, ToolsIcon, SplitViewIcon, PreviewOnlyIcon, CodeOnlyIcon } from "./Icons";
import { AppContextMenu, type ContextMenuItem } from "./AppContextMenu";
import { ConfirmDialog } from "./ConfirmDialog";
import { SplitSquareHorizontal, SplitSquareVertical } from "lucide-react";
import "../styles/tabs.css";

export function EditorTabs() {
  const { tabs, activeTabId, setActiveTab, closeTab } = useEditorStore();
  const { mdView, cycleMdView } = useLayoutStore();
  // 批量关闭确认: 若涉及未保存修改, 先弹确认
  const [batchConfirm, setBatchConfirm] = useState<{
    count: number;
    action: () => void;
  } | null>(null);

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

  // 批量关闭守卫: 若待关闭列表含 dirty tab, 弹确认; 否则直接执行
  const guardBatchClose = (toClose: { id: string; isDirty: boolean }[], action: () => void) => {
    const dirtyCount = toClose.filter((t) => t.isDirty).length;
    if (dirtyCount > 0) {
      setBatchConfirm({ count: dirtyCount, action });
    } else {
      action();
    }
  };

  // 构造某个 Tab 的右键菜单
  const buildMenu = (tabId: string): ContextMenuItem[] => {
    const idx = tabs.findIndex((t) => t.id === tabId);
    const items: ContextMenuItem[] = [
      { id: "close", label: "关闭", onSelect: () => {
        const t = tabs.find((x) => x.id === tabId);
        if (t) handleClose(t.id, t.name, t.isDirty);
      } },
      { id: "close-others", label: "关闭其他", disabled: tabs.length <= 1, onSelect: () => {
        const others = tabs.filter((t) => t.id !== tabId);
        guardBatchClose(others, () => useEditorStore.getState().closeOthers(tabId));
      } },
      { id: "close-left", label: "关闭左侧", disabled: idx <= 0, onSelect: () => {
        const left = tabs.slice(0, idx);
        guardBatchClose(left, () => useEditorStore.getState().closeTabsToLeft(tabId));
      } },
      { id: "close-right", label: "关闭右侧", disabled: idx >= tabs.length - 1, onSelect: () => {
        const right = tabs.slice(idx + 1);
        guardBatchClose(right, () => useEditorStore.getState().closeTabsToRight(tabId));
      } },
      { id: "sep1", separator: true },
      { id: "close-all", label: "关闭全部", danger: true, onSelect: () => {
        guardBatchClose(tabs, () => useEditorStore.getState().closeAll());
      } },
      { id: "sep2", separator: true },
      {
        id: "split-h",
        label: "分屏打开 (左右)",
        icon: <SplitSquareHorizontal size={14} strokeWidth={1.5} />,
        onSelect: () => {
          const st = useEditorStore.getState();
          st.setSplitOrientation("horizontal");
          // 若该 tab 不在第二组则移过去
          if (!st.splitTabs.some((t) => t.id === tabId)) st.moveToSplit(tabId);
        },
      },
      {
        id: "split-v",
        label: "分屏打开 (上下)",
        icon: <SplitSquareVertical size={14} strokeWidth={1.5} />,
        onSelect: () => {
          const st = useEditorStore.getState();
          st.setSplitOrientation("vertical");
          if (!st.splitTabs.some((t) => t.id === tabId)) st.moveToSplit(tabId);
        },
      },
    ];
    return items;
  };

  return (
    <div className="tabs-wrap">
      <div className="tabs">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const iconType = getFileIconType(tab.name, false);
          return (
            <AppContextMenu key={tab.id} items={buildMenu(tab.id)}>
              <div
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
                  ) : tab.kind === "tool" ? (
                    <ToolsIcon size={15} />
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
            </AppContextMenu>
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
      {/* 批量关闭确认(涉及未保存修改) */}
      <ConfirmDialog
        open={batchConfirm !== null}
        title="未保存的修改"
        message={
          batchConfirm
            ? `将关闭 ${batchConfirm.count} 个有未保存修改的标签，修改将丢失。\n是否继续？`
            : ""
        }
        confirmLabel="不保存并关闭"
        danger
        onConfirm={() => {
          if (batchConfirm) batchConfirm.action();
          setBatchConfirm(null);
        }}
        onCancel={() => setBatchConfirm(null)}
      />
    </div>
  );
}

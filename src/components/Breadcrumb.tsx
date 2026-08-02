import { useEditorStore } from "../stores/editorStore";
import { useLayoutStore } from "../stores/layoutStore";
import { ChevronRight } from "lucide-react";
import "../styles/breadcrumb.css";

/**
 * 路径面包屑: 编辑器顶部显示当前文件路径
 */
export function Breadcrumb() {
  const activeTab = useEditorStore((s) =>
    s.tabs.find((t) => t.id === s.activeTabId)
  );
  const workspaceRoot = useLayoutStore((s) => s.workspaceRoot);

  if (!activeTab || activeTab.kind !== "file" || !workspaceRoot) return null;

  // 相对路径分段
  const relPath = activeTab.path.startsWith(workspaceRoot)
    ? activeTab.path.slice(workspaceRoot.length + 1)
    : activeTab.path;

  const parts = relPath.split("/").filter(Boolean);

  return (
    <div className="breadcrumb">
      {parts.map((part, i) => (
        <span key={i} className="breadcrumb__item">
          {i > 0 && <ChevronRight size={12} className="breadcrumb__sep" />}
          <span className={i === parts.length - 1 ? "breadcrumb__current" : "breadcrumb__path"}>
            {part}
          </span>
        </span>
      ))}
    </div>
  );
}

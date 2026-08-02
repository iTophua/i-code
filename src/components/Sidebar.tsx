import { useLayoutStore, type SidebarView } from "../stores/layoutStore";
import { FileTree } from "./FileTree";
import { SearchPanel } from "./SearchPanel";
import { NotesPanel } from "./NotesPanel";
import { GitPanel } from "./GitPanel";
import { SettingsPanel } from "./SettingsPanel";
import { ToolsPanel } from "./ToolsPanel";

export function Sidebar() {
  const { sidebarView } = useLayoutStore();

  return (
    <div className="sidebar">
      <div key={sidebarView} className="sidebar__panel">
        {renderView(sidebarView)}
      </div>
    </div>
  );
}

function renderView(view: SidebarView) {
  switch (view) {
    case "explorer":
      return <FileTree />;
    case "search":
      return <SearchPanel />;
    case "git":
      return <GitPanel />;
    case "notes":
      return <NotesPanel />;
    case "tools":
      return <ToolsPanel />;
    case "settings":
      return <SettingsPanel />;
    default:
      return null;
  }
}

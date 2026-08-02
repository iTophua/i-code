import { useLayoutStore, type SidebarView } from "../stores/layoutStore";
import { FileTree } from "./FileTree";
import { SearchPanel } from "./SearchPanel";
import { NotesPanel } from "./NotesPanel";
import { GitPanel } from "./GitPanel";
import { SettingsPanel } from "./SettingsPanel";

export function Sidebar() {
  const { sidebarView } = useLayoutStore();

  return <div className="sidebar">{renderView(sidebarView)}</div>;
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
      return <PlaceholderView title="工具" hint="M5 实现" />;
    case "settings":
      return <SettingsPanel />;
    default:
      return null;
  }
}

function PlaceholderView({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="placeholder-view">
      <div className="placeholder-view__title">{title}</div>
      <div className="placeholder-view__hint">{hint}</div>
    </div>
  );
}

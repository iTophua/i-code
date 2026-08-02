import { useState, useEffect, useRef, useMemo } from "react";
import { useLayoutStore } from "../stores/layoutStore";
import { useEditorStore } from "../stores/editorStore";
import { Search } from "lucide-react";
import "../styles/command-palette.css";

interface Command {
  id: string;
  label: string;
  shortcut?: string;
  action: () => void;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // 全局快捷键 Cmd+Shift+P
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.shiftKey && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // 打开时聚焦输入
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIdx(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // 构建命令列表
  const commands = useMemo<Command[]>(() => {
    const layout = useLayoutStore.getState();
    const editor = useEditorStore.getState();
    return [
      { id: "open-folder", label: "打开文件夹", shortcut: "Cmd+O", action: () => window.dispatchEvent(new KeyboardEvent("keydown", { metaKey: true, key: "o" })) },
      { id: "toggle-sidebar", label: "切换侧栏", shortcut: "Cmd+B", action: layout.toggleSidebar },
      { id: "toggle-terminal", label: "切换终端", shortcut: "Ctrl+`", action: layout.togglePanel },
      { id: "toggle-zen", label: "切换 Zen 模式", shortcut: "Cmd+Shift+Z", action: layout.toggleZen },
      { id: "view-explorer", label: "视图: 资源管理器", action: () => layout.setSidebarView("explorer") },
      { id: "view-search", label: "视图: 搜索", shortcut: "Cmd+Shift+F", action: () => layout.setSidebarView("search") },
      { id: "view-git", label: "视图: 源代码管理", action: () => layout.setSidebarView("git") },
      { id: "view-notes", label: "视图: 便签", action: () => layout.setSidebarView("notes") },
      { id: "view-tools", label: "视图: 工具", action: () => layout.setSidebarView("tools") },
      { id: "view-settings", label: "视图: 设置", action: () => layout.setSidebarView("settings") },
      { id: "view-problems", label: "视图: 问题", action: () => layout.setPanelView("problems") },
      { id: "close-tab", label: "关闭当前标签", shortcut: "Cmd+W", action: () => { if (editor.activeTabId) editor.closeTab(editor.activeTabId); } },
      { id: "reopen-closed", label: "恢复关闭的标签", shortcut: "Cmd+Shift+T", action: editor.reopenClosed },
      { id: "open-settings", label: "打开设置", action: () => layout.setSidebarView("settings") },
    ];
  }, [open]);

  // 过滤
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(q));
  }, [query, commands]);

  // 键盘导航
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[selectedIdx]) {
        filtered[selectedIdx].action();
        setOpen(false);
      }
    }
  };

  // 滚动到选中项
  useEffect(() => {
    const el = listRef.current?.children[selectedIdx] as HTMLDivElement;
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIdx]);

  if (!open) return null;

  return (
    <div className="cmd-palette-overlay" onClick={() => setOpen(false)}>
      <div className="cmd-palette" onClick={(e) => e.stopPropagation()}>
        <div className="cmd-palette__input-wrap">
          <Search size={14} className="cmd-palette__icon" />
          <input
            ref={inputRef}
            type="text"
            className="cmd-palette__input"
            placeholder="输入命令..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIdx(0); }}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div className="cmd-palette__list" ref={listRef}>
          {filtered.length === 0 ? (
            <div className="cmd-palette__empty">无匹配命令</div>
          ) : (
            filtered.map((cmd, i) => (
              <div
                key={cmd.id}
                className={`cmd-palette__item ${i === selectedIdx ? "cmd-palette__item--active" : ""}`}
                onClick={() => { cmd.action(); setOpen(false); }}
                onMouseEnter={() => setSelectedIdx(i)}
              >
                <span className="cmd-palette__label">{cmd.label}</span>
                {cmd.shortcut && <span className="cmd-palette__shortcut">{cmd.shortcut}</span>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

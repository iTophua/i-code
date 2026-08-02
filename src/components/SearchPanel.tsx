import { useState, useMemo } from "react";
import { useSearchStore, type SearchHit } from "../stores/searchStore";
import { useLayoutStore } from "../stores/layoutStore";
import { useEditorStore } from "../stores/editorStore";
import { invoke } from "@tauri-apps/api/core";
import { getLanguage } from "../utils/language";
import { getFileIconType } from "../utils/language";
import { FileIcon } from "./FileIcon";
import "../styles/search.css";

export function SearchPanel() {
  const {
    query,
    caseSensitive,
    isRegex,
    hits,
    searching,
    done,
    total,
    setQuery,
    toggleCase,
    toggleRegex,
    runSearch,
  } = useSearchStore();
  const workspaceRoot = useLayoutStore((s) => s.workspaceRoot);
  const openFile = useEditorStore((s) => s.openFile);

  // 按文件分组
  const grouped = useMemo(() => {
    const map = new Map<string, { fileName: string; hits: SearchHit[] }>();
    for (const h of hits) {
      let g = map.get(h.path);
      if (!g) {
        g = { fileName: h.fileName, hits: [] };
        map.set(h.path, g);
      }
      g.hits.push(h);
    }
    return Array.from(map.entries());
  }, [hits]);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleGroup = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (workspaceRoot) runSearch(workspaceRoot);
  };

  const openHit = async (hit: SearchHit) => {
    try {
      const [content] = await invoke<[string, string]>("read_file", {
        filePath: hit.path,
      });
      openFile({
        path: hit.path,
        name: hit.fileName,
        content,
        language: getLanguage(hit.fileName),
        preview: true,
      });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="search-panel">
      <div className="search-panel__header">
        <span className="search-panel__title">搜索</span>
      </div>

      <form className="search-panel__form" onSubmit={onSubmit}>
        <div className="search-panel__input-wrap">
          <input
            type="text"
            className="search-panel__input"
            placeholder="搜索..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <div className="search-panel__toggles">
            <button
              type="button"
              className={`search-toggle ${caseSensitive ? "search-toggle--on" : ""}`}
              onClick={toggleCase}
              title="区分大小写"
            >
              Aa
            </button>
            <button
              type="button"
              className={`search-toggle ${isRegex ? "search-toggle--on" : ""}`}
              onClick={toggleRegex}
              title="正则表达式"
            >
              .*
            </button>
          </div>
        </div>
      </form>

      {!workspaceRoot ? (
        <div className="search-panel__empty">请先打开一个项目文件夹</div>
      ) : (
        <div className="search-panel__results">
          {searching && hits.length === 0 && (
            <div className="search-panel__status">搜索中...</div>
          )}
          {done && hits.length === 0 && query && (
            <div className="search-panel__status">未找到结果</div>
          )}
          {hits.length > 0 && (
            <>
              <div className="search-panel__count">
                {total} 个结果{total >= 2000 ? " (已达上限)" : ""}
              </div>
              {grouped.map(([path, group]) => (
                <div key={path} className="search-group">
                  <div
                    className="search-group__header"
                    onClick={() => toggleGroup(path)}
                  >
                    <span className="search-group__chevron">
                      {expanded.has(path) ? "▾" : "▸"}
                    </span>
                    <FileIcon
                      type={getFileIconType(group.fileName, false)}
                      size={15}
                    />
                    <span className="search-group__name">{group.fileName}</span>
                    <span className="search-group__count">
                      {group.hits.length}
                    </span>
                    <span className="search-group__path" title={path}>
                      {shortenPath(path, workspaceRoot)}
                    </span>
                  </div>
                  {expanded.has(path) && (
                    <div className="search-group__hits">
                      {group.hits.map((hit, i) => (
                        <div
                          key={i}
                          className="search-hit"
                          onClick={() => openHit(hit)}
                          title={hit.path}
                        >
                          <span className="search-hit__line">{hit.line}</span>
                          <span className="search-hit__content">
                            {hit.lineContent.slice(0, 200)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function shortenPath(fullPath: string, root: string): string {
  if (fullPath.startsWith(root)) {
    const rel = fullPath.slice(root.length).replace(/^\//, "");
    return rel;
  }
  return fullPath;
}

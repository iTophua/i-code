import { useEffect, useState, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Search, Loader2, ChevronUp, ChevronDown } from "lucide-react";
import "../styles/logviewer.css";

interface SearchResult {
  line: number;
  content: string;
  match_start: number;
  match_len: number;
}

/**
 * 大文件/日志查看器
 * Rust 行索引 + 分块读取 + 虚拟滚动 + 流式搜索
 */
export function LogViewer({ filePath, fileName }: { filePath: string; fileName: string }) {
  const [lineCount, setLineCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchIdx, setSearchIdx] = useState(-1);
  const [searching, setSearching] = useState(false);

  // 虚拟滚动
  const [visibleLines, setVisibleLines] = useState<string[]>([]);
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const ITEM_HEIGHT = 20;
  const PRELOAD = 50;

  // 可视区行号范围
  const viewportH = containerRef.current?.clientHeight || 600;
  const startLine = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - PRELOAD);
  const endLine = Math.min(lineCount, startLine + Math.ceil(viewportH / ITEM_HEIGHT) + PRELOAD * 2);

  // 构建索引
  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const count = await invoke<number>("build_line_index", { filePath });
        setLineCount(count);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [filePath]);

  // 滚动时分块加载行
  useEffect(() => {
    if (lineCount === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const lines = await invoke<string[]>("read_lines", {
          filePath,
          startLine,
          endLine,
        });
        if (!cancelled) {
          setVisibleLines(lines);
        }
      } catch (e) {
        console.error("读取行失败:", e);
      }
    })();
    return () => { cancelled = true; };
  }, [filePath, startLine, endLine, lineCount]);

  const handleScroll = (e: React.UIEvent) => {
    setScrollTop((e.target as HTMLDivElement).scrollTop);
  };

  // 搜索
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const results = await invoke<SearchResult[]>("search_large_file", {
        filePath,
        query: searchQuery,
        maxResults: 5000,
      });
      setSearchResults(results);
      setSearchIdx(0);
      if (results.length > 0) {
        jumpToLine(results[0].line);
      }
    } catch (e) {
      console.error("搜索失败:", e);
    } finally {
      setSearching(false);
    }
  }, [filePath, searchQuery]);

  // 跳转到行
  const jumpToLine = (line: number) => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTop = (line - 1) * ITEM_HEIGHT;
  };

  // 上一个/下一个搜索结果
  const navSearch = (dir: 1 | -1) => {
    if (searchResults.length === 0) return;
    const next = (searchIdx + dir + searchResults.length) % searchResults.length;
    setSearchIdx(next);
    jumpToLine(searchResults[next].line);
  };

  if (loading) {
    return (
      <div className="log-viewer">
        <div className="log-viewer__loading">
          <Loader2 className="animate-spin" size={24} />
          <span>正在构建行索引...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="log-viewer">
        <div className="log-viewer__error">{error}</div>
      </div>
    );
  }

  // 计算可视区偏移
  const offsetY = startLine * ITEM_HEIGHT;

  return (
    <div className="log-viewer">
      <div className="log-viewer__header">
        <span className="log-viewer__title">📄 {fileName}</span>
        <span className="log-viewer__count">{lineCount.toLocaleString()} 行</span>
      </div>

      {/* 搜索栏 */}
      <div className="log-viewer__search">
        <Search size={14} className="log-viewer__search-icon" />
        <input
          type="text"
          placeholder="搜索日志..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
        {searching && <Loader2 size={14} className="animate-spin" />}
        {searchResults.length > 0 && (
          <>
            <span className="log-viewer__search-count">
              {searchIdx + 1}/{searchResults.length}
            </span>
            <button className="log-viewer__nav-btn" onClick={() => navSearch(-1)} title="上一个">
              <ChevronUp size={14} />
            </button>
            <button className="log-viewer__nav-btn" onClick={() => navSearch(1)} title="下一个">
              <ChevronDown size={14} />
            </button>
          </>
        )}
      </div>

      {/* 虚拟滚动列表 */}
      <div className="log-viewer__body" ref={containerRef} onScroll={handleScroll}>
        <div style={{ height: lineCount * ITEM_HEIGHT, position: "relative" }}>
          <div style={{ transform: `translateY(${offsetY}px)` }}>
            {visibleLines.map((line, i) => {
              const lineNum = startLine + i + 1;
              const isMatch = searchResults.some((r) => r.line === lineNum);
              return (
                <div key={lineNum} className={`log-line ${isMatch ? "log-line--match" : ""}`}>
                  <span className="log-line__num">{lineNum}</span>
                  <span className="log-line__content">{line}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

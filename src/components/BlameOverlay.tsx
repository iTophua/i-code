import { useState, useEffect, useMemo } from "react";
import type { editor } from "monaco-editor";

interface BlameLineInfo {
  author: string;
  time: string;
  summary: string;
  hash: string;
}

interface Props {
  ed: editor.IStandaloneCodeEditor | null;
  blameMap: Map<number, BlameLineInfo> | null;
}

export function BlameOverlay({ ed, blameMap }: Props) {
  const [scrollTop, setScrollTop] = useState(0);
  const [lineHeight, setLineHeight] = useState(21);
  const [padTop, setPadTop] = useState(12);
  // 字号与行号保持一致(读取编辑器 fontSize, 用户改设置也能同步)
  const [fontSize, setFontSize] = useState(12);
  // 当前悬浮行(显示自定义提示框, 替代原生 title)
  const [hover, setHover] = useState<BlameLineInfo | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    if (!ed) return;
    const opts = ed.getRawOptions();
    setLineHeight(opts.lineHeight || 21);
    setPadTop(opts.padding?.top ?? 12);
    setFontSize(opts.fontSize ?? 12);
    const sub = ed.onDidScrollChange(() => {
      setScrollTop(ed.getScrollTop());
    });
    return () => sub.dispose();
  }, [ed]);

  const rows = useMemo(() => {
    if (!blameMap) return [];
    const result: { line: number; info: BlameLineInfo; y: number }[] = [];
    for (const [line, info] of blameMap) {
      // 每行的 Y 位置 = (行号-1) * 行高 + paddingTop - scrollTop
      const y = (line - 1) * lineHeight + padTop - scrollTop;
      result.push({ line, info, y });
    }
    return result;
  }, [blameMap, lineHeight, padTop, scrollTop]);

  if (!blameMap) return null;

  return (
    <div className="blame-overlay">
      {rows.map(({ line, info, y }) => (
        <div
          key={line}
          className="blame-overlay__row"
          style={{ top: `${y}px`, height: `${lineHeight}px`, fontSize: fontSize - 1 }}
          onMouseEnter={(e) => {
            setHover(info);
            setHoverPos({ x: e.clientX, y: e.clientY });
          }}
          onMouseMove={(e) => {
            setHoverPos({ x: e.clientX, y: e.clientY });
          }}
          onMouseLeave={() => setHover(null)}
        >
          <span className="blame-overlay__date">{info.time}</span>
          <span className="blame-overlay__author">{info.author}</span>
        </div>
      ))}
      {hover && (
        <div
          className="blame-tip"
          style={{
            left: hoverPos.x + 14,
            top: hoverPos.y + 14,
          }}
        >
          <div className="blame-tip__summary">{hover.summary}</div>
          <div className="blame-tip__meta">
            <span className="blame-tip__hash">{hover.hash}</span>
            <span className="blame-tip__author">{hover.author}</span>
            <span className="blame-tip__time">{hover.time}</span>
          </div>
        </div>
      )}
    </div>
  );
}


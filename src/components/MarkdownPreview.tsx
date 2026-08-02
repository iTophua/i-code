import { useEffect, useRef, useMemo } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import "../styles/markdown.css";

interface Props {
  /** markdown 源码 */
  content: string;
  /** 同步滚动的来源编辑器滚动比例(0-1), 编辑器滚动时传入 */
  scrollRatio?: number;
  /** 滚动比例变化时的回调(预览滚动时通知编辑器, 暂未用) */
  onScroll?: (ratio: number) => void;
}

marked.setOptions({
  gfm: true,
  breaks: true,
});

/**
 * Markdown 实时预览
 * marked 解析 + DOMPurify 防 XSS + 同步滚动
 */
export function MarkdownPreview({ content, scrollRatio, onScroll }: Props) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);

  const html = useMemo(() => {
    const raw = marked.parse(content, { async: false }) as string;
    return DOMPurify.sanitize(raw);
  }, [content]);

  // 编辑器滚动 → 预览跟随(按比例)
  useEffect(() => {
    if (scrollRatio === undefined) return;
    const el = bodyRef.current;
    if (!el || syncing.current) return;
    syncing.current = true;
    const max = el.scrollHeight - el.clientHeight;
    el.scrollTop = max * scrollRatio;
    requestAnimationFrame(() => {
      syncing.current = false;
    });
  }, [scrollRatio]);

  // 预览滚动 → 通知编辑器(反向同步)
  const handleScroll = () => {
    if (syncing.current) return;
    const el = bodyRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    if (max <= 0) return;
    onScroll?.(el.scrollTop / max);
  };

  return (
    <div className="md-preview">
      <div
        ref={bodyRef}
        className="md-preview__body markdown-body"
        onScroll={handleScroll}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

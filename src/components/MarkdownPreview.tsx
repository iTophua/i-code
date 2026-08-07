import { useEffect, useRef, useMemo } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { convertFileSrc } from "@tauri-apps/api/core";
import "../styles/markdown.css";

interface Props {
  /** markdown 源码 */
  content: string;
  /** md 文件绝对路径(用于解析图片相对路径) */
  filePath?: string;
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
 * 将 markdown 图片 src 转为 Tauri 可加载的 URL。
 * - http(s)/data: → 原样返回
 * - 绝对路径 → convertFileSrc
 * - 相对路径 → 基于 md 文件目录拼接为绝对路径 → convertFileSrc
 */
function resolveImgSrc(src: string, mdDir: string): string {
  if (/^(https?:|data:|asset:|tauri:)/i.test(src)) return src;
  // 绝对路径(Unix / 或 Windows 盘符 X:)
  if (src.startsWith("/") || /^[a-zA-Z]:/.test(src)) {
    return convertFileSrc(src);
  }
  // 相对路径: 基于 md 文件目录
  const fullPath = mdDir ? `${mdDir}/${src}` : src;
  return convertFileSrc(fullPath);
}

/**
 * Markdown 实时预览
 * marked 解析 + 图片路径转换 + DOMPurify 防 XSS + 同步滚动
 */
export function MarkdownPreview({ content, filePath, scrollRatio, onScroll }: Props) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);

  const html = useMemo(() => {
    // md 文件所在目录(用于解析相对图片路径)
    const mdDir = filePath ? filePath.substring(0, filePath.lastIndexOf("/")) : "";

    let raw = marked.parse(content, { async: false }) as string;

    // 后处理: 把 <img src="..."> 的相对/绝对路径转为 Tauri 可加载的 URL
    raw = raw.replace(/<img\s+src="([^"]*)"/g, (_match, src: string) => {
      const resolved = resolveImgSrc(src, mdDir);
      return `<img src="${resolved}"`;
    });

    return DOMPurify.sanitize(raw, {
      ADD_TAGS: ["img"],
      ADD_ATTR: ["src", "alt", "title"],
    });
  }, [content, filePath]);

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

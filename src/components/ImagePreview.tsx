import { useEffect, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { invoke } from "@tauri-apps/api/core";

/**
 * 图片预览: 通过 Tauri asset protocol 直接加载本地图片(零拷贝, 不走 base64)
 */
export function ImagePreview({ filePath, fileName }: { filePath: string; fileName: string }) {
  const url = convertFileSrc(filePath);
  const [meta, setMeta] = useState<{ size: string; dims: string } | null>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    setMeta(null);
    setZoom(1);
    let cancelled = false;
    // 读取文件大小
    invoke<number>("get_file_size", { filePath })
      .then((bytes) => {
        if (!cancelled) {
          setMeta((m) => ({ size: formatSize(bytes), dims: m?.dims ?? "" }));
        }
      })
      .catch(() => {});
    // 读取图片尺寸 —— 卸载时取消(onerror 防止异常静默丢弃; src 置空释放解码缓冲)
    const img = new Image();
    img.onload = () => {
      if (!cancelled) {
        setMeta((m) => ({ size: m?.size ?? "", dims: `${img.naturalWidth} × ${img.naturalHeight}` }));
      }
    };
    img.onerror = () => {
      /* 尺寸探测失败静默处理(<img> 主元素会显示 onError) */
    };
    img.src = url;
    return () => {
      cancelled = true;
      // 释放 Image 解码缓冲(浏览器会缓存已解码图片, 主动断开引用加速回收)
      img.onload = null;
      img.onerror = null;
      img.src = "";
    };
  }, [filePath, url]);

  return (
    <div className="image-preview">
      <div className="image-preview__toolbar">
        <span className="image-preview__name">{fileName}</span>
        {meta && (
          <span className="image-preview__meta">
            {meta.dims && <span>{meta.dims}</span>}
            {meta.size && <span>{meta.size}</span>}
          </span>
        )}
        <span className="image-preview__zoom">
          <button
            className="image-preview__btn"
            onClick={() => setZoom((z) => Math.max(0.1, z - 0.25))}
            title="缩小"
          >
            −
          </button>
          <span className="image-preview__zoom-val">{Math.round(zoom * 100)}%</span>
          <button
            className="image-preview__btn"
            onClick={() => setZoom((z) => Math.min(8, z + 0.25))}
            title="放大"
          >
            +
          </button>
          <button
            className="image-preview__btn image-preview__btn--reset"
            onClick={() => setZoom(1)}
            title="重置"
          >
            重置
          </button>
        </span>
      </div>
      <div className="image-preview__stage">
        <img
          src={url}
          alt={fileName}
          style={{ transform: `scale(${zoom})` }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      </div>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

import { useRef, useState, useCallback } from "react";

/**
 * VS Code 式四象限拖拽分屏覆盖层
 *
 * 拖 tab 进入编辑区时显示,鼠标位置决定落点象限:
 *  - 左/右半区 → 水平分屏(horizontal, 左右并排)
 *  - 上/下半区 → 垂直分屏(vertical, 上下堆叠)
 *
 * 用法:父容器(onDragOver 时渲染本组件)传入 rect,本组件计算高亮象限,
 *       onDrop 时父容器读取 getZone() 决定分屏方向。
 */

export type DropZone = "left" | "right" | "top" | "bottom" | null;

interface Props {
  /** 父容器 DOMRect(用于计算相对坐标) */
  rect: DOMRect;
  /** 当前高亮象限(由父组件根据鼠标位置计算后传入) */
  zone: DropZone;
}

export function DragSplitOverlay({ rect, zone }: Props) {
  // 四个半区,仅高亮当前 zone
  const base = "drop-zone__half";
  return (
    <div className="drop-overlay" style={overlayStyle(rect)}>
      <div className={`${base} ${zone === "top" ? "drop-zone__half--active" : ""}`} style={{ top: 0, left: 0, right: 0, height: "50%" }} />
      <div className={`${base} ${zone === "bottom" ? "drop-zone__half--active" : ""}`} style={{ bottom: 0, left: 0, right: 0, height: "50%" }} />
      <div className={`${base} ${zone === "left" ? "drop-zone__half--active" : ""}`} style={{ top: 0, bottom: 0, left: 0, width: "50%" }} />
      <div className={`${base} ${zone === "right" ? "drop-zone__half--active" : ""}`} style={{ top: 0, bottom: 0, right: 0, width: "50%" }} />
      {/* 中心提示 */}
      <div className="drop-zone__hint">
        {zone === "left" && "← 左侧分屏"}
        {zone === "right" && "右侧分屏 →"}
        {zone === "top" && "↑ 上方分屏"}
        {zone === "bottom" && "↓ 下方分屏"}
      </div>
    </div>
  );
}

function overlayStyle(rect: DOMRect): React.CSSProperties {
  return {
    position: "fixed",
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    pointerEvents: "none",
    zIndex: 50,
  };
}

/**
 * 根据鼠标坐标 + 容器 rect 计算落点象限
 * - 用对角线划分:靠近左/右边 vs 上/下边
 * - 简化:横向 x < 1/3 → left, x > 2/3 → right;纵向 y < 1/3 → top, y > 2/3 → bottom;中间取较近的边
 */
export function computeZone(clientX: number, clientY: number, rect: DOMRect): DropZone {
  const x = (clientX - rect.left) / rect.width; // 0~1
  const y = (clientY - rect.top) / rect.height; // 0~1
  // 距四边的距离
  const dl = x;
  const dr = 1 - x;
  const dt = y;
  const db = 1 - y;
  const min = Math.min(dl, dr, dt, db);
  // 只在最外侧 1/3 区域才判定为分屏(中心区域不分屏,避免误触)
  if (min > 0.33) return null;
  if (min === dl) return "left";
  if (min === dr) return "right";
  if (min === dt) return "top";
  return "bottom";
}

/**
 * 拖拽分屏 hook:封装 onDragOver/onDragLeave/onDrop 逻辑
 * 返回 { wrapRef, overlay, handlers } —— wrapRef 绑到目标容器, overlay 传给渲染层
 *
 * @param onDropTab 落点确定时的回调(tabId, 来源是否分屏组, zone)
 */
export function useDragSplit(
  onDropTab: (tabId: string, fromSplit: boolean, zone: DropZone) => void
) {
  const [dragging, setDragging] = useState(false);
  const [zone, setZone] = useState<DropZone>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    // 仅处理 tab 拖拽(检查自定义 MIME)
    if (!e.dataTransfer.types.includes("application/x-tab-id")) return;
    e.preventDefault(); // 允许 drop
    e.dataTransfer.dropEffect = "move";

    if (!dragging) setDragging(true);
    // 计算 zone
    const r = wrapRef.current?.getBoundingClientRect();
    if (r) {
      setRect(r);
      setZone(computeZone(e.clientX, e.clientY, r));
    }
  }, [dragging]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // 离开容器(到子元素不算) → 隐藏
    if (e.currentTarget === e.target) {
      setDragging(false);
      setZone(null);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData("application/x-tab-id");
    if (!raw) {
      setDragging(false);
      setZone(null);
      return;
    }
    let tabId = "";
    let fromSplit = false;
    try {
      const parsed = JSON.parse(raw) as { tabId: string; fromSplit: boolean };
      tabId = parsed.tabId;
      fromSplit = parsed.fromSplit;
    } catch {
      setDragging(false);
      setZone(null);
      return;
    }
    const r = wrapRef.current?.getBoundingClientRect();
    const finalZone = r ? computeZone(e.clientX, e.clientY, r) : null;
    if (finalZone) {
      onDropTab(tabId, fromSplit, finalZone);
    }
    setDragging(false);
    setZone(null);
  }, [onDropTab]);

  return {
    wrapRef,
    overlay: dragging && rect ? { rect, zone } : null,
    handlers: {
      onDragOver: handleDragOver,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop,
    },
  };
}

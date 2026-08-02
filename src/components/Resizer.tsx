import { useRef, useCallback } from "react";
import { useLayoutStore } from "../stores/layoutStore";

/**
 * 可拖拽的水平分隔条(调整侧栏宽度)
 */
export function VerticalResizer() {
  const { sidebarWidth, setSidebarWidth } = useLayoutStore();
  const dragging = useRef(false);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;
      const startX = e.clientX;
      const startWidth = sidebarWidth;

      const onMove = (ev: MouseEvent) => {
        if (!dragging.current) return;
        const dx = ev.clientX - startX;
        const newWidth = Math.min(600, Math.max(170, startWidth + dx));
        setSidebarWidth(newWidth);
      };
      const onUp = () => {
        dragging.current = false;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
      document.body.style.cursor = "col-resize";
    },
    [sidebarWidth, setSidebarWidth]
  );

  return (
    <div
      className="resizer resizer--vertical"
      onMouseDown={onMouseDown}
      title="拖动调整宽度"
    />
  );
}

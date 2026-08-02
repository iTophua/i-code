import { useEffect, useRef } from "react";
import "../styles/contextmenu.css";

export interface MenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  /** 分隔线(只看这个字段,其他忽略) */
  separator?: boolean;
  /** 危险操作(红色) */
  danger?: boolean;
}

interface Props {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // 点击外部/ESC 关闭
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    // 延迟绑定, 避免触发右键的那次 click
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClick);
      document.addEventListener("keydown", handleKey);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  // 边界修正(避免溢出窗口)
  const adjustedX = Math.min(x, window.innerWidth - 220);
  const adjustedY = Math.min(y, window.innerHeight - items.length * 26 - 12);

  return (
    <div
      className="context-menu"
      ref={ref}
      style={{ left: adjustedX, top: adjustedY }}
    >
      {items.map((item) =>
        item.separator ? (
          <div key={item.id} className="context-menu__separator" />
        ) : (
          <button
            key={item.id}
            className={`context-menu__item ${item.disabled ? "context-menu__item--disabled" : ""} ${item.danger ? "context-menu__item--danger" : ""}`}
            disabled={item.disabled}
            onClick={() => {
              item.onClick?.();
              onClose();
            }}
          >
            {item.icon && <span className="context-menu__icon">{item.icon}</span>}
            <span className="context-menu__label">{item.label}</span>
          </button>
        )
      )}
    </div>
  );
}

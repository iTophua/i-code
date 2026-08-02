import { useState, useRef, useEffect, type ReactNode } from "react";

interface MenuItem {
  id?: string;
  label: string;
  shortcut?: string;
  onClick?: () => void;
  separator?: boolean;
  disabled?: boolean;
}

interface Pos {
  x: number;
  y: number;
}

const menuStyles: React.CSSProperties = {
  position: "fixed",
  minWidth: 200,
  padding: 4,
  background: "var(--bg-menu)",
  border: "1px solid var(--border-base)",
  borderRadius: "var(--radius-md)",
  boxShadow: "var(--shadow-menu)",
  zIndex: "var(--z-menu)",
  animation: "menu-in 0.13s cubic-bezier(0.16, 1, 0.3, 1)",
};

const itemStyles: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
  height: 28,
  padding: "0 12px",
  borderRadius: "var(--radius-sm)",
  color: "var(--fg-primary)",
  fontFamily: "var(--font-ui)",
  fontSize: "var(--fs-base)",
  cursor: "pointer",
  userSelect: "none",
  border: "none",
  background: "transparent",
  width: "100%",
  textAlign: "left",
  transition: "var(--t-color)",
};

const sepStyles: React.CSSProperties = {
  height: 1,
  margin: "4px 8px",
  background: "var(--border-subtle)",
};

const shortcutStyles: React.CSSProperties = {
  color: "var(--fg-muted)",
  fontFamily: "var(--font-mono)",
  fontSize: "var(--fs-xs)",
};

/**
 * 编辑器自定义右键菜单(全中文)
 * 替代 Monaco 默认的英文 contextmenu
 */
export function EditorContextMenu({
  children,
  items,
}: {
  children: ReactNode;
  items: MenuItem[];
}) {
  const [pos, setPos] = useState<Pos | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pos) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setPos(null);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [pos]);

  return (
    <div
      style={{ display: "flex", flex: 1, minHeight: 0, flexDirection: "column" }}
      onContextMenu={(e) => {
        e.preventDefault();
        // 估算菜单高度(每项 28px + padding), 底部超出视口时向上偏移
        const estHeight = items.length * 28 + 16;
        const maxY = window.innerHeight - estHeight - 8;
        setPos({
          x: Math.min(e.clientX, window.innerWidth - 220),
          y: e.clientY > maxY ? maxY : e.clientY,
        });
      }}
    >
      {children}
      {pos && (
        <div ref={ref} style={{ ...menuStyles, left: pos.x, top: pos.y, maxHeight: "70vh", overflowY: "auto" }}>
          {items.map((item, i) =>
            item.separator ? (
              <div key={i} style={sepStyles} />
            ) : (
              <button
                key={i}
                style={{
                  ...itemStyles,
                  ...(item.disabled
                    ? { opacity: 0.4, cursor: "default" }
                    : {}),
                }}
                disabled={item.disabled}
                onClick={() => {
                  item.onClick?.();
                  setPos(null);
                }}
                onMouseEnter={(e) => {
                  if (!item.disabled) {
                    e.currentTarget.style.background = "var(--bg-menu-hover)";
                    e.currentTarget.style.color = "var(--fg-on-accent)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "var(--fg-primary)";
                }}
              >
                <span>{item.label}</span>
                {item.shortcut && (
                  <span style={shortcutStyles}>{item.shortcut}</span>
                )}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

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
 *
 * 关闭机制: 用全屏透明遮罩(backdrop)捕获外部点击, 不再用 document mousedown 监听。
 * 原方案 document mousedown 与按钮 click 之间有时序竞争, 导致第一次点击只关闭菜单、
 * 不触发 onClick(表现为"点两次才生效")。遮罩方案下外部点击直接命中遮罩 → 一次到位。
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

  // ESC 关闭
  useEffect(() => {
    if (!pos) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPos(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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
        <>
          {/* 全屏透明遮罩: 捕获菜单外部点击并关闭。
              关键: 只用 onContextMenu/onClick 关闭, 不用 mousedown —— 否则
              按下菜单项时 mousedown 会先命中遮罩导致整组卸载, click 不触发(点两次)。 */}
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: "var(--z-menu)",
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              setPos(null);
            }}
            onClick={() => setPos(null)}
          />
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
                  onMouseDown={(e) => {
                    // 在 mousedown 阶段就执行 + 关闭, 不依赖 click 完整序列
                    // (click 在某些场景会被 Monaco/焦点切换打断, 表现为第一次点击无效)
                    e.stopPropagation();
                    e.preventDefault();
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
        </>
      )}
    </div>
  );
}

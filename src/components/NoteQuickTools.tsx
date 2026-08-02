import { useState, useRef, useEffect } from "react";
import { Wand2 } from "lucide-react";

/**
 * 便签快捷工具
 * 根据当前便签语言显示对应的快速操作按钮:
 * - JSON: 格式化 / 压缩 / 校验
 * - SQL: 格式化 / 压缩
 * - 其他语言: 不显示
 *
 * 点击主按钮展开二级操作菜单(下拉)
 */
interface ActionDef {
  id: string;
  label: string;
}

const ACTIONS_BY_LANG: Record<string, ActionDef[]> = {
  json: [
    { id: "json-format", label: "格式化" },
    { id: "json-minify", label: "压缩" },
    { id: "json-validate", label: "校验" },
  ],
  sql: [
    { id: "sql-format", label: "格式化" },
    { id: "sql-minify", label: "压缩" },
  ],
};

export function NoteQuickTools({
  language,
  onAction,
}: {
  language: string;
  onAction: (action: string) => void;
}) {
  const actions = ACTIONS_BY_LANG[language];
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // 外部点击关闭
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // 语言切换后, 若当前菜单已展开但无操作 → 收起
  useEffect(() => {
    if (!actions) setOpen(false);
  }, [language, actions]);

  if (!actions || actions.length === 0) return null;

  return (
    <div className="note-quick" ref={wrapRef}>
      <button
        className="note-quick__trigger"
        onClick={() => setOpen((v) => !v)}
        title="便签快捷工具"
      >
        <Wand2 size={14} strokeWidth={1.5} />
        <span>工具</span>
      </button>
      {open && (
        <div className="note-quick__menu">
          {actions.map((a) => (
            <button
              key={a.id}
              className="note-quick__item"
              onClick={() => {
                onAction(a.id);
                setOpen(false);
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

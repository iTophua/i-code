import { useEffect, useRef, useState } from "react";

/**
 * 分支操作对话框(新建分支 / 从此分支新建 / 重命名)
 * 通用模态:标题 + 输入框 + (可选)"创建后切换"复选框 + 确认/取消
 */
interface Props {
  open: boolean;
  title: string;
  /** 输入框 placeholder */
  placeholder?: string;
  /** 初始值(重命名时填旧名) */
  initialValue?: string;
  /** 副标题/说明(如"从 feature/x 创建") */
  hint?: string;
  /** 是否显示"创建后切换"复选框(新建场景) */
  showCheckoutOption?: boolean;
  confirmLabel?: string;
  onConfirm: (name: string, checkout: boolean) => void;
  onCancel: () => void;
}

export function BranchDialog({
  open,
  title,
  placeholder = "分支名...",
  initialValue = "",
  hint,
  showCheckoutOption = false,
  confirmLabel = "创建",
  onConfirm,
  onCancel,
}: Props) {
  const [name, setName] = useState(initialValue);
  const [checkout, setCheckout] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(initialValue);
      setCheckout(true);
      // 聚焦输入框
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open, initialValue]);

  if (!open) return null;

  const trimmed = name.trim();
  const handleConfirm = () => {
    if (!trimmed) return;
    onConfirm(trimmed, checkout);
  };

  return (
    <div className="cmd-palette-overlay" onClick={onCancel}>
      <div className="branch-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="branch-dialog__title">{title}</div>
        {hint && <div className="branch-dialog__hint">{hint}</div>}
        <input
          ref={inputRef}
          className="branch-dialog__input"
          placeholder={placeholder}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleConfirm();
            if (e.key === "Escape") onCancel();
          }}
        />
        {showCheckoutOption && (
          <label className="branch-dialog__check">
            <input
              type="checkbox"
              checked={checkout}
              onChange={(e) => setCheckout(e.target.checked)}
            />
            <span>创建后切换到该分支</span>
          </label>
        )}
        <div className="branch-dialog__actions">
          <button className="btn btn--secondary" onClick={onCancel}>取消</button>
          <button
            className="btn btn--primary"
            disabled={!trimmed}
            onClick={handleConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

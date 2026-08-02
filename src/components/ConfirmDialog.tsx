import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import "./ui/radix-theme.css";

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  /** 可选的第三按钮(主操作, 如"保存")。提供时按 [确认][第三] 排列 */
  tertiaryLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  onTertiary?: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "确定",
  cancelLabel = "取消",
  danger = false,
  tertiaryLabel,
  onConfirm,
  onCancel,
  onTertiary,
}: Props) {
  const hasTertiary = !!onTertiary;
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="app-dialog-overlay" />
        <Dialog.Content className="app-dialog-content">
          <Dialog.Title className="app-dialog-title">{title}</Dialog.Title>
          {/* 右上角关闭按钮(与"取消"等效) */}
          <button
            className="app-dialog-close"
            onClick={onCancel}
            title={cancelLabel}
            aria-label={cancelLabel}
          >
            <X size={16} strokeWidth={1.75} />
          </button>
          <Dialog.Description className="app-dialog-description" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {message}
          </Dialog.Description>
          <div className="app-dialog-actions">
            <button
              className={`btn ${danger ? "btn--danger" : "btn--primary"}`}
              onClick={onConfirm}
              autoFocus={!hasTertiary}
            >
              {confirmLabel}
            </button>
            {hasTertiary && (
              <button className="btn btn--primary" onClick={onTertiary}>
                {tertiaryLabel}
              </button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

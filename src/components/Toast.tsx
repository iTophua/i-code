import { useToastStore, type ToastType } from "../stores/toastStore";
import { Check, X, Info, AlertTriangle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import "../styles/toast.css";

const ICONS: Record<ToastType, LucideIcon> = {
  success: Check,
  error: X,
  warning: AlertTriangle,
  info: Info,
};

export function ToastContainer() {
  const { toasts, remove } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((t) => {
        const Icon = ICONS[t.type] || Info;
        return (
          <div key={t.id} className={`toast toast--${t.type}`} onClick={() => remove(t.id)}>
            <span className="toast__icon">
              <Icon size={14} />
            </span>
            <span className="toast__msg">{t.message}</span>
          </div>
        );
      })}
    </div>
  );
}

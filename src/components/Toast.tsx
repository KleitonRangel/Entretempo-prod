import { Icon } from "./Icon";
import type { ToastState } from "../types";

export function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  return (
    <div
      className={`toast ${toast.tone === "danger" ? "toast-danger" : ""}`}
      role="status"
      aria-live="polite"
    >
      <span className="toast-icon">
        <Icon name={toast.tone === "danger" ? "trash" : "check"} size={15} />
      </span>
      <span className="toast-message">{toast.message}</span>
      {toast.action ? (
        <button
          type="button"
          className="toast-action"
          onClick={() => {
            toast.action?.run();
            onClose();
          }}
        >
          <Icon name="undo" size={14} />
          {toast.action.label}
        </button>
      ) : null}
      <button type="button" className="toast-close" onClick={onClose} aria-label="Fechar aviso">
        <Icon name="close" size={13} />
      </button>
    </div>
  );
}

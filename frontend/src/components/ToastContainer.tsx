"use client";

import { useToastStore } from "@/stores/toast.store";

const TOAST_ICONS: Record<string, string> = {
  success: "check_circle",
  error: "error",
  info: "info",
};

const TOAST_COLORS: Record<string, string> = {
  success: "bg-[#E6F4EA] text-[#137333] border-[#C6F2D9]",
  error: "bg-[#FCE8E6] text-[#C5221F] border-[#FFCECA]",
  info: "bg-surface-container-low text-on-surface border-outline-variant",
};

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 w-80">
      {toasts.map((toast) => {
        const colors = TOAST_COLORS[toast.type] || TOAST_COLORS.info;
        const icon = TOAST_ICONS[toast.type] || TOAST_ICONS.info;
        return (
          <div
            key={toast.id}
            className={`flex items-start gap-3 px-4 py-3 rounded-lg border text-body-sm shadow-lg animate-in slide-in-from-bottom-2 fade-in-0 ${colors}`}
          >
            <span className="material-symbols-outlined text-lg shrink-0 mt-0.5">
              {icon}
            </span>
            <div className="flex-1">
              {toast.title && (
                <p className="font-medium mb-0.5">{toast.title}</p>
              )}
              <p>{toast.message}</p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="ml-2 text-current opacity-60 hover:opacity-100 transition-opacity"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}

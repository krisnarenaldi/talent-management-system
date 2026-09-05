import { create } from "zustand";

export type ToastType = "success" | "error" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
}

interface ToastState {
  toasts: Toast[];
  showToast: (type: ToastType, message: string, title?: string) => void;
  removeToast: (id: string) => void;
}

let toastId = 0;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  showToast: (type, message, title) => {
    const id = `toast-${toastId++}`;
    const toast: Toast = { id, type, message, title };
    set((state) => ({ toasts: [...state.toasts, toast] }));

    const duration = type === "error" ? 8000 : 4000;
    setTimeout(() => get().removeToast(id), duration);
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));

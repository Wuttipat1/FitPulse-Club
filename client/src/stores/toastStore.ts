import { create } from 'zustand';
import type { Toast, ToastType } from '../types';

interface ToastInput {
  type?: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastState {
  toasts: Toast[];
  push: (toast: ToastInput) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

const MAX_TOASTS = 4;
const timers = new Map<string, ReturnType<typeof setTimeout>>();

export const useToastStore = create<ToastState>()((set, get) => ({
  toasts: [],
  push: ({ type = 'info', title, message, duration = 4000 }) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const toast: Toast = { id, type, title, message, duration };
    set((s) => ({ toasts: [...s.toasts, toast].slice(-MAX_TOASTS) }));
    if (duration > 0) {
      timers.set(
        id,
        setTimeout(() => get().dismiss(id), duration),
      );
    }
    return id;
  },
  dismiss: (id) => {
    const t = timers.get(id);
    if (t) {
      clearTimeout(t);
      timers.delete(id);
    }
    set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }));
  },
  clear: () => {
    timers.forEach((t) => clearTimeout(t));
    timers.clear();
    set({ toasts: [] });
  },
}));

/** Imperative helpers usable anywhere (components, api layer, etc.). */
export const toast = {
  success: (title: string, message?: string, duration?: number) =>
    useToastStore.getState().push({ type: 'success', title, message, duration }),
  error: (title: string, message?: string, duration?: number) =>
    useToastStore.getState().push({ type: 'error', title, message, duration: duration ?? 5500 }),
  info: (title: string, message?: string, duration?: number) =>
    useToastStore.getState().push({ type: 'info', title, message, duration }),
  warning: (title: string, message?: string, duration?: number) =>
    useToastStore.getState().push({ type: 'warning', title, message, duration }),
};

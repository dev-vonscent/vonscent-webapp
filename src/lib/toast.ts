"use client";

import { create } from "zustand";

/**
 * Global toast store. Fire from anywhere with `toast("...")` or
 * `toast.error("...")` — <Toaster /> in the root layout renders them.
 */

export interface ToastItem {
  id: string;
  title?: string;
  description: string;
  variant: "default" | "destructive";
}

interface ToastState {
  toasts: ToastItem[];
  add: (t: Omit<ToastItem, "id">) => void;
  dismiss: (id: string) => void;
}

let counter = 0;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  add: (t) =>
    set((s) => ({
      // Keep at most 3 on screen; drop the oldest.
      toasts: [...s.toasts.slice(-2), { ...t, id: String(++counter) }],
    })),
  dismiss: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function toast(description: string, title?: string) {
  useToastStore.getState().add({ description, title, variant: "default" });
}

toast.error = (description: string, title?: string) => {
  useToastStore.getState().add({ description, title, variant: "destructive" });
};

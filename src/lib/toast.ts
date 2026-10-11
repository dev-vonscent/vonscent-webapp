"use client";

import { toast as sonner } from "sonner";

/**
 * Thin adapter over sonner keeping the original call shape:
 * `toast("...")` / `toast.error("...", "Гарчиг")` — <Toaster /> in the root
 * layout renders them.
 */
export function toast(description: string, title?: string) {
  if (title) sonner(title, { description });
  else sonner(description);
}

toast.error = (description: string, title?: string) => {
  if (title) sonner.error(title, { description });
  else sonner.error(description);
};

toast.success = (description: string, title?: string) => {
  if (title) sonner.success(title, { description });
  else sonner.success(description);
};

/** Toast доторх товч — хэрэглэгчийн даралт тул `window.open` popup blocker-т хаагдахгүй. */
export interface ToastAction {
  label: string;
  onClick: () => void;
}

/** Алдаа + хамгийн ихдээ хоёр гарц (sonner-ийн action / cancel). */
toast.errorWithActions = (
  description: string,
  title: string,
  [primary, secondary]: ToastAction[],
) => {
  sonner.error(title, {
    description,
    duration: 10_000,
    ...(primary && { action: primary }),
    ...(secondary && { cancel: secondary }),
    // Sonner-ийн өгөгдмөл товч theme-ийг үл тоож хар (navy дээр ч), cancel нь
    // бүдэг саарал — theme token-оор. Хоёр гарц ижил чухал тул хоёулаа тод.
    classNames: {
      actionButton: "!bg-foreground !text-background",
      cancelButton: "!bg-secondary !text-foreground",
    },
  });
};

/** Удаан үйлдлийн явц; `toast.dismiss(id)`-аар хаана. */
toast.loading = (description: string) => sonner.loading(description);
toast.dismiss = (id: string | number) => sonner.dismiss(id);

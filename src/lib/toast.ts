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

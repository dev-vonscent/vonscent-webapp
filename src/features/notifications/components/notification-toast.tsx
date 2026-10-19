"use client";

import * as React from "react";
import { Bell, X } from "lucide-react";
import type { AppNotification } from "../types";
import { NotificationThumb } from "./notification-item";

/**
 * Toast-ын агуулга (sonner `toast.custom`). Бүхэлдээ дарагдана — шилжинэ;
 * хаах товч тусдаа. Хөдөлгөөнийг sonner өөрөө `prefers-reduced-motion`-оор
 * зохицуулна.
 */
function ToastShell({
  onOpen,
  onClose,
  children,
}: {
  onOpen: () => void;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card text-card-foreground border-border shadow-lift relative flex w-full items-start rounded-xl border sm:w-89">
      <button
        type="button"
        onClick={onOpen}
        className="focus-visible:ring-ring flex min-w-0 flex-1 items-start gap-3 rounded-xl p-3 pr-10 text-left focus-visible:ring-2 focus-visible:outline-none"
      >
        {children}
      </button>
      <button
        type="button"
        onClick={onClose}
        aria-label="Хаах"
        className="hover:bg-secondary text-muted-foreground absolute top-1.5 right-1.5 flex size-8 items-center justify-center rounded-full transition-colors"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

export function NotificationToast({
  notification: n,
  onOpen,
  onClose,
}: {
  notification: AppNotification;
  onOpen: () => void;
  onClose: () => void;
}) {
  return (
    <ToastShell onOpen={onOpen} onClose={onClose}>
      <NotificationThumb notification={n} className="size-10" />
      <span className="min-w-0 flex-1 space-y-0.5">
        <span className="line-clamp-2 block text-sm font-semibold">
          {n.title}
        </span>
        {n.body && (
          <span className="text-muted-foreground line-clamp-2 block text-sm">
            {n.body}
          </span>
        )}
      </span>
    </ToastShell>
  );
}

export function NotificationSummaryToast({
  count,
  onOpen,
  onClose,
}: {
  count: number;
  onOpen: () => void;
  onClose: () => void;
}) {
  return (
    <ToastShell onOpen={onOpen} onClose={onClose}>
      <span
        aria-hidden
        className="bg-secondary flex size-10 shrink-0 items-center justify-center rounded-lg"
      >
        <Bell className="size-5" />
      </span>
      <span className="min-w-0 flex-1 space-y-0.5">
        <span className="block text-sm font-semibold">
          {count} шинэ мэдэгдэл
        </span>
        <span className="text-muted-foreground block text-sm">
          Дарж бүгдийг нь үзээрэй.
        </span>
      </span>
    </ToastShell>
  );
}

"use client";

import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";
import { useToastStore } from "@/lib/toast";

export function Toaster() {
  const { toasts, dismiss } = useToastStore();

  return (
    <ToastProvider duration={4500} swipeDirection="up">
      {toasts.map((t) => (
        <Toast
          key={t.id}
          variant={t.variant}
          onOpenChange={(open) => {
            if (!open) dismiss(t.id);
          }}
        >
          <div className="space-y-0.5">
            {t.title && <ToastTitle>{t.title}</ToastTitle>}
            <ToastDescription>{t.description}</ToastDescription>
          </div>
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}

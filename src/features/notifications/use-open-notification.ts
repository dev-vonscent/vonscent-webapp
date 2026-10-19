"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  isInternalNotificationUrl,
  isSafeNotificationUrl,
} from "@/lib/validators/notification";
import type { AppNotification } from "./types";
import { useMarkNotificationsRead } from "./use-notifications";

/**
 * Мэдэгдэл дээр дарах: уншаагүй бол уншсан болгоно (optimistic), дараа нь
 * дотоод зам → `router.push`, гадаад → шинэ tab.
 */
export function useOpenNotification(onNavigate?: () => void) {
  const router = useRouter();
  const markRead = useMarkNotificationsRead();
  const { mutate } = markRead;

  return React.useCallback(
    (n: Pick<AppNotification, "id" | "read" | "url">) => {
      if (!n.read) mutate({ ids: [n.id] });
      // Сан дээр URL-ийн формат check байхгүй — defense-in-depth.
      if (!n.url || !isSafeNotificationUrl(n.url)) return;
      onNavigate?.();
      if (isInternalNotificationUrl(n.url)) {
        router.push(n.url);
      } else {
        window.open(n.url, "_blank", "noopener,noreferrer");
      }
    },
    [mutate, onNavigate, router],
  );
}

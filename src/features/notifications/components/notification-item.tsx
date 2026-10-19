"use client";

import * as React from "react";
import Image from "next/image";
import { formatRelative } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { AppNotification } from "../types";
import { NotificationKindIcon } from "./notification-icon";

/** Thumbnail (48×48) эсвэл төрлийн дүрс. */
export function NotificationThumb({
  notification,
  className,
}: {
  notification: Pick<AppNotification, "kind" | "imageUrl">;
  className?: string;
}) {
  if (notification.imageUrl) {
    return (
      <Image
        src={notification.imageUrl}
        alt=""
        width={48}
        height={48}
        sizes="48px"
        className={cn("size-12 shrink-0 rounded-lg object-cover", className)}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "bg-secondary text-foreground flex size-12 shrink-0 items-center justify-center rounded-lg",
        className,
      )}
    >
      <NotificationKindIcon kind={notification.kind} className="size-5" />
    </span>
  );
}

/**
 * Нэг мөр — panel ба `/account/notifications` хоёул. Дарахад уншсан болгоод
 * холбоос руу (`onOpen`). Текст нь plain — HTML render хийхгүй (XSS).
 */
export function NotificationItem({
  notification: n,
  onOpen,
}: {
  notification: AppNotification;
  onOpen: (n: AppNotification) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(n)}
      className={cn(
        "hover:bg-accent focus-visible:ring-ring flex w-full items-start gap-3 rounded-xl p-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none",
        !n.read && "bg-secondary",
      )}
    >
      <NotificationThumb notification={n} />
      <span className="min-w-0 flex-1 space-y-0.5">
        <span className="flex items-start gap-2">
          <span
            className={cn(
              "line-clamp-2 flex-1 text-sm",
              n.read ? "font-normal" : "font-semibold",
            )}
          >
            {n.title}
          </span>
          {!n.read && (
            <span className="bg-destructive mt-1.5 size-2 shrink-0 rounded-full">
              <span className="sr-only">Уншаагүй</span>
            </span>
          )}
        </span>
        {n.body && (
          <span className="text-muted-foreground line-clamp-3 block text-sm">
            {n.body}
          </span>
        )}
        <time
          dateTime={n.visibleAt}
          className="text-muted-foreground block text-xs"
        >
          {formatRelative(n.visibleAt)}
        </time>
      </span>
    </button>
  );
}

"use client";

import * as React from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import {
  NOTIFICATION_PAGE_SIZE,
  NOTIFICATION_PANEL_LIMIT,
} from "@/lib/constants";
import { useNotificationFeed } from "../use-notifications";
import { useOpenNotification } from "../use-open-notification";
import { NotificationItem } from "./notification-item";

/**
 * Мэдэгдлийн жагсаалт — panel (эхний 10) ба `/account/notifications`
 * («Цааш үзэх»-тэй) хоёул.
 */
export function NotificationList({
  enabled = true,
  firstPageOnly = false,
  onNavigate,
  emptySurface = "muted",
}: {
  enabled?: boolean;
  firstPageOnly?: boolean;
  onNavigate?: () => void;
  emptySurface?: "dashed" | "muted";
}) {
  // Хонхны panel (desktop popover, утасны sheet) — хөнгөн эхний 10; бусдыг нь
  // «Бүгдийг харах» хуудас 20-оор.
  const feed = useNotificationFeed({
    enabled,
    limit: firstPageOnly ? NOTIFICATION_PANEL_LIMIT : NOTIFICATION_PAGE_SIZE,
  });
  const open = useOpenNotification(onNavigate);

  if (feed.isPending) {
    return (
      <div className="space-y-2" aria-busy>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex gap-3 p-3">
            <Skeleton className="size-12 shrink-0 rounded-lg" />
            <div className="flex-1 space-y-2 pt-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (feed.isError) {
    return (
      <EmptyState
        icon={Bell}
        surface={emptySurface}
        size="sm"
        title="Мэдэгдэл ачаалж чадсангүй"
        description="Сүлжээгээ шалгаад дахин оролдоно уу."
        action={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void feed.refetch()}
          >
            Дахин оролдох
          </Button>
        }
      />
    );
  }

  const pages = firstPageOnly ? feed.data.pages.slice(0, 1) : feed.data.pages;
  const items = pages.flatMap((p) => p.items);

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Bell}
        surface={emptySurface}
        size="sm"
        title="Одоогоор мэдэгдэл алга"
        description="Захиалгын явц, V оноо, хямдрал, шинэ үнэртний мэдээ энд ирнэ."
      />
    );
  }

  return (
    <div className="space-y-1">
      <ul className="space-y-1">
        {items.map((n) => (
          <li key={n.id}>
            <NotificationItem notification={n} onOpen={open} />
          </li>
        ))}
      </ul>
      {!firstPageOnly && feed.hasNextPage && (
        <div className="flex justify-center pt-3">
          <Button
            variant="secondary"
            onClick={() => void feed.fetchNextPage()}
            disabled={feed.isFetchingNextPage}
          >
            {feed.isFetchingNextPage ? "Ачаалж байна…" : "Цааш үзэх"}
          </Button>
        </div>
      )}
    </div>
  );
}

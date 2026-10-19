"use client";

import { Button } from "@/components/ui/button";
import {
  useMarkNotificationsRead,
  useNotificationPoll,
} from "../use-notifications";
import { NotificationList } from "./notification-list";

export function NotificationsPage() {
  const { data } = useNotificationPoll();
  const markRead = useMarkNotificationsRead();
  const unread = data?.unread ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="hidden font-serif text-2xl font-semibold md:block">
          Мэдэгдэл
        </h1>
        <Button
          variant="link"
          size="sm"
          className="ml-auto h-auto px-0"
          disabled={unread === 0 || markRead.isPending}
          onClick={() => markRead.mutate({ all: true })}
        >
          Бүгдийг уншсан болгох
        </Button>
      </div>
      <NotificationList emptySurface="dashed" />
    </div>
  );
}

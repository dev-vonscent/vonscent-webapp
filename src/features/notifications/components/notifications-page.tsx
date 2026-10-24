"use client";

import { Button } from "@/components/ui/button";
import { AccountPageHeader } from "@/features/account/components/account-page-header";
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
      <AccountPageHeader
        title="Мэдэгдэл"
        aside={
          <Button
            variant="link"
            size="sm"
            className="h-auto px-0"
            disabled={unread === 0 || markRead.isPending}
            onClick={() => markRead.mutate({ all: true })}
          >
            Бүгдийг уншсан болгох
          </Button>
        }
      />
      <NotificationList emptySurface="dashed" />
    </div>
  );
}

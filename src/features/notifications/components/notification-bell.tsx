"use client";

import * as React from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { bellLabel, formatBadge } from "../lib";
import {
  useMarkNotificationsRead,
  useNotificationPoll,
  useNotificationUserId,
} from "../use-notifications";
import { NotificationList } from "./notification-list";

/**
 * Header-ийн хонх + panel (баруун талын sheet, сагстай ижил хэлбэр).
 * Туг хаалттай эсвэл зочин бол юу ч render хийхгүй (plan #3).
 */
export function NotificationBell({
  triggerVariant = "ghost",
  triggerClassName,
}: {
  triggerVariant?: ButtonProps["variant"];
  triggerClassName?: string;
}) {
  const userId = useNotificationUserId();
  const { data } = useNotificationPoll();
  const markRead = useMarkNotificationsRead();
  const [open, setOpen] = React.useState(false);
  const close = React.useCallback(() => setOpen(false), []);

  if (!userId) return null;
  const unread = data?.unread ?? 0;
  const badge = formatBadge(unread);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant={triggerVariant}
          size="icon"
          aria-label={bellLabel(unread)}
          className={cn("relative", triggerClassName)}
        >
          <Bell className="size-5" />
          {badge && (
            <span
              aria-hidden
              className="bg-destructive text-destructive-foreground absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums"
            >
              {badge}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full max-w-md gap-0 px-3 pb-4">
        <SheetHeader className="px-3 pb-3">
          <SheetTitle>Мэдэгдэл</SheetTitle>
          <Button
            variant="link"
            size="sm"
            className="h-auto self-start px-0"
            disabled={unread === 0 || markRead.isPending}
            onClick={() => markRead.mutate({ all: true })}
          >
            Бүгдийг уншсан болгох
          </Button>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto">
          <NotificationList enabled={open} firstPageOnly onNavigate={close} />
        </div>
        <div className="px-3 pt-3">
          <Button asChild variant="secondary" className="w-full">
            <Link href="/account/notifications" onClick={close}>
              Бүгдийг харах
            </Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

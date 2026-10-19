"use client";

import * as React from "react";
import Link from "next/link";
import { Popover } from "@base-ui/react/popover";
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

function useBell() {
  const userId = useNotificationUserId();
  const { data } = useNotificationPoll();
  const markRead = useMarkNotificationsRead();
  const [open, setOpen] = React.useState(false);
  const close = React.useCallback(() => setOpen(false), []);
  const unread = data?.unread ?? 0;
  return { userId, unread, markRead, open, setOpen, close };
}

function BellIcon({ unread }: { unread: number }) {
  const badge = formatBadge(unread);
  return (
    <>
      <Bell className="size-5" />
      {badge && (
        <span
          aria-hidden
          className="bg-destructive text-destructive-foreground absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums"
        >
          {badge}
        </span>
      )}
    </>
  );
}

/**
 * Утасны хонх — баруун талын sheet (сагстай ижил хэлбэр). Hover байхгүй
 * мэдрэгчтэй дэлгэцэд бүтэн өндөртэй жагсаалт илүү тохиромжтой.
 * Туг хаалттай эсвэл зочин бол юу ч render хийхгүй (plan #3).
 */
export function NotificationBell({
  triggerVariant = "ghost",
  triggerClassName,
}: {
  triggerVariant?: ButtonProps["variant"];
  triggerClassName?: string;
}) {
  const { userId, unread, markRead, open, setOpen, close } = useBell();
  if (!userId) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant={triggerVariant}
          size="icon"
          aria-label={bellLabel(unread)}
          className={cn("relative rounded-full", triggerClassName)}
        >
          <BellIcon unread={unread} />
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

/**
 * Desktop хонх — хонхны доор гарч ирэх жижиг panel. Hover-оор (бага зэрэг
 * саатлаар) нээгдэнэ, дарахад ч нээгдэнэ/хаагдана; хулгана panel руу шилжих
 * зуур хаагдахгүй (Base UI-ийн safe polygon). Гарнаас Enter/Space.
 */
export function NotificationBellPopover({ className }: { className?: string }) {
  const { userId, unread, markRead, open, setOpen, close } = useBell();
  if (!userId) return null;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        openOnHover
        delay={150}
        closeDelay={200}
        aria-label={bellLabel(unread)}
        className={cn(
          "text-muted-foreground hover:bg-secondary hover:text-foreground data-popup-open:bg-secondary data-popup-open:text-foreground focus-visible:ring-ring relative flex size-9 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none",
          className,
        )}
      >
        <BellIcon unread={unread} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          side="bottom"
          align="end"
          sideOffset={10}
          className="z-50 outline-none"
        >
          <Popover.Popup className="border-border bg-popover text-popover-foreground shadow-lift flex max-h-[min(32rem,var(--available-height))] w-96 max-w-(--available-width) origin-(--transform-origin) flex-col overflow-hidden rounded-2xl border transition-[opacity,scale] duration-150 outline-none data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 motion-reduce:transition-none">
            <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-2">
              <Popover.Title className="text-base font-semibold">
                Мэдэгдэл
              </Popover.Title>
              <Button
                variant="link"
                size="sm"
                className="h-auto px-0 text-xs"
                disabled={unread === 0 || markRead.isPending}
                onClick={() => markRead.mutate({ all: true })}
              >
                Бүгдийг уншсан болгох
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-2">
              <NotificationList
                enabled={open}
                firstPageOnly
                onNavigate={close}
              />
            </div>
            <div className="border-border border-t p-2">
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="w-full rounded-lg"
              >
                <Link href="/account/notifications" onClick={close}>
                  Бүгдийг харах
                </Link>
              </Button>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

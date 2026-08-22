"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BellRing, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import type { AdminNotification } from "@/features/admin/api";

/**
 * Unread admin notifications (order cancellations, A1). The card disappears
 * once everything is read — quiet days stay quiet.
 */
export function NotificationList({
  notifications,
}: {
  notifications: AdminNotification[];
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);

  if (notifications.length === 0) return null;

  async function markRead(id: string) {
    setBusy(id);
    try {
      await fetch(`/api/admin/notifications/${id}`, { method: "PATCH" });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="border-destructive/40">
      <CardContent className="p-5">
        <h2 className="mb-3 flex items-center gap-2 font-medium">
          <BellRing className="text-destructive size-4" />
          Шинэ мэдэгдэл ({notifications.length})
        </h2>
        <ul className="space-y-2">
          {notifications.map((n) => (
            <li
              key={n.id}
              className="flex items-start justify-between gap-3 text-sm"
            >
              <div>
                {n.order_id ? (
                  <Link
                    href={`/admin/orders/${n.order_id}`}
                    className="hover:text-gold-strong"
                  >
                    {n.message}
                  </Link>
                ) : (
                  <span>{n.message}</span>
                )}
                <p className="text-muted-foreground text-xs">
                  {formatDate(n.created_at)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy === n.id}
                onClick={() => markRead(n.id)}
                aria-label="Уншсан"
              >
                <Check className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

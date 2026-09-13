"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { mutate } from "@/features/admin/lib/mutate";
import { BellRing, Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatTimeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AdminNotification } from "@/features/admin/api";

/**
 * Мэдэгдлийн жагсаалт — самбарын карт болон `/admin/notifications` хуудас
 * хоёулаа үүнийг хэрэглэнэ. Уншсан мөр бүдэгхэн, «уншсан» товчгүй.
 */
export function NotificationItems({
  notifications,
}: {
  notifications: AdminNotification[];
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);

  async function markRead(id: string) {
    setBusy(id);
    try {
      if (
        await mutate(
          `/api/admin/notifications/${id}`,
          { method: "PATCH" },
          "Уншсан гэж тэмдэглэгдсэнгүй",
        )
      )
        router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <ul className="space-y-2">
      {notifications.map((n) => (
        <li
          key={n.id}
          className={cn(
            "flex items-start justify-between gap-3 text-sm",
            n.is_read && "opacity-60",
          )}
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
            <p
              className="text-muted-foreground text-xs"
              suppressHydrationWarning
            >
              {formatTimeAgo(n.created_at)}
              {n.is_read && " · уншсан"}
            </p>
          </div>
          {!n.is_read && (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy === n.id}
              onClick={() => markRead(n.id)}
              aria-label="Уншсан"
            >
              <Check className="size-4" />
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * Самбарын хамгийн дээд карт: хонх, «Шинэ мэдэгдэл (N)», «Бүгдийг харах».
 *
 * Мэдэгдлийн ЖАГСААЛТ энд БАЙХГҮЙ: самбар бол тоймын хуудас, уншсан болгох
 * зэрэг ажил `/admin/notifications` дээр хийгдэнэ. Урьд нь уншаагүй байхгүй
 * үед карт бүхэлдээ алга болдог байсныг ч больсон — түүхийн хуудас руу орох
 * хаалга чимээгүй өдөр ч байрандаа байх ёстой.
 */
export function NotificationCard({ unread }: { unread: number }) {
  return (
    <Card className={unread ? "bg-destructive/10" : undefined}>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
        <h2 className="flex items-center gap-2 font-medium">
          <BellRing
            className={cn(
              "size-4",
              unread ? "text-destructive" : "text-muted-foreground",
            )}
          />
          Шинэ мэдэгдэл ({unread})
        </h2>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/notifications">
            Бүгдийг харах <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { NotificationItems } from "@/features/admin/components/notification-list";
import { getAllNotifications } from "@/features/admin/api";

export const metadata: Metadata = { title: "Мэдэгдэл" };

/** Хэдэн мэдэгдлийн түүхийг нэг хуудсанд харуулах вэ. */
const HISTORY_LIMIT = 100;

/**
 * Мэдэгдлийн түүх. Самбарын карт зөвхөн УНШААГҮЙг харуулдаг тул уншсан
 * мэдэгдэл тэндээс алга болдог — энд бүгд, шинэ нь эхэндээ байна.
 */
export default async function AdminNotificationsPage() {
  const notifications = await getAllNotifications(HISTORY_LIMIT);
  const unread = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="space-y-6">
      <Link
        href="/admin"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> Хяналтын самбар
      </Link>

      <PageHeader
        title="Мэдэгдэл"
        count={notifications.length}
        description={
          notifications.length === 0
            ? "Мэдэгдэл хараахан алга."
            : `Уншаагүй ${unread}. Сүүлийн ${HISTORY_LIMIT} мэдэгдэл харагдана.`
        }
      />

      <Card>
        <CardContent className="p-5">
          {notifications.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Захиалга цуцлагдах зэрэг үйл явдал болмогц энд бүртгэгдэнэ.
            </p>
          ) : (
            <NotificationItems notifications={notifications} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

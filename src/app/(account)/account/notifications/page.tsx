import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { NotificationsPage } from "@/features/notifications/components/notifications-page";

/** `/account/notifications` — бүх мэдэгдэл (0138, туг `notifications`). */
export const metadata: Metadata = {
  title: "Мэдэгдэл",
  robots: { index: false, follow: false },
};

export default async function AccountNotificationsPage() {
  if (!(await isFeatureEnabled("notifications"))) notFound();
  return <NotificationsPage />;
}

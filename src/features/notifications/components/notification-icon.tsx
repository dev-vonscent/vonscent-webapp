import * as React from "react";
import {
  Bell,
  BellRing,
  Bookmark,
  CreditCard,
  Gift,
  Megaphone,
  PackageCheck,
  PackagePlus,
  Percent,
  Rocket,
  RotateCcw,
  Truck,
  XCircle,
} from "lucide-react";
import { VPointIcon } from "@/components/shared/v-point-icon";
import type { NotificationKind } from "../types";

type IconComponent = React.ComponentType<{ className?: string }>;

/** Зураггүй мэдэгдлийн дүрс — төрлөөс (plan §4.3, §6). */
const ICONS: Record<NotificationKind, IconComponent> = {
  product_new: PackagePlus,
  promotion: Percent,
  campaign: Megaphone,
  feature: Rocket,
  announcement: BellRing,
  points_released: VPointIcon,
  free_spin_ready: Gift,
  order_paid: CreditCard,
  order_shipping: Truck,
  order_delivered: PackageCheck,
  order_cancelled: XCircle,
  order_refunded: RotateCcw,
  order_saved: Bookmark,
};

/** Төрлийн дүрс — map-аас сонгоно (render бүрт шинэ component үүсгэхгүй). */
export function NotificationKindIcon({
  kind,
  className,
}: {
  kind: NotificationKind;
  className?: string;
}) {
  return React.createElement(ICONS[kind] ?? Bell, { className });
}

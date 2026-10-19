/** `notification_kind_t` (0138). Шинэ төрөл нь migration-д `add value`-ээр. */
export const NOTIFICATION_KINDS = [
  // broadcast
  "product_new",
  "promotion",
  "campaign",
  "feature",
  "announcement",
  // personal
  "points_released",
  "free_spin_ready",
  "order_paid",
  "order_shipping",
  "order_delivered",
  "order_cancelled",
  "order_refunded",
  "order_saved",
] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/** Хэрэглэгчид харагдах нэг мэдэгдэл (API хариу). */
export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  url: string | null;
  /** `image_path`-аас серверт үүсгэсэн public URL. */
  imageUrl: string | null;
  read: boolean;
  visibleAt: string;
}

/** `GET /api/notifications` */
export interface NotificationFeedPage {
  items: AppNotification[];
  /** Дараагийн хуудас; null = төгсгөл. */
  nextCursor: string | null;
}

/** `GET /api/notifications/poll` */
export interface NotificationPoll {
  unread: number;
  /** Өмнөх cursor-оос хойш шинээр харагдсан нийт тоо. */
  freshCount: number;
  /** Хамгийн шинэ ≤5 (шинэ нь эхэнд). Анхны poll-д үргэлж хоосон. */
  fresh: AppNotification[];
  nextCursor: string;
}

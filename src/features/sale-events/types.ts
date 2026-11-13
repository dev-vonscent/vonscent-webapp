import type { Gender } from "@/db/types";

/** Одоо явж буй арга хэмжээ (0181 `live_sale_events()`) — дэлгүүрийн харагдац. */
export interface LiveSaleEvent {
  slug: string;
  name: string;
  /** Картан дээрх тэмдэг; null → «Хямдрал». */
  badgeLabel: string | null;
  headline: string | null;
  description: string | null;
  startsAt: string;
  /** Exclusive хил (дуусах өдрийн дараах 00:00, УБ). */
  endsAt: string;
  showCountdown: boolean;
  productIds: string[];
}

export type SaleEventState = "scheduled" | "live" | "ended";

/** Нэг slug-ийн нийтийн төлөв (`sale_event_public`) — хувь, бараа байхгүй. */
export interface SaleEventPublic {
  slug: string;
  name: string;
  state: SaleEventState;
  startsAt: string;
  endsAt: string;
}

/** Админы төлөв: ноорог + нийтийн гурван төлөв. */
export type SaleEventPhase = "draft" | SaleEventState;

/** Админы жагсаалт / маягтын нэг мөр. */
export interface SaleEventAdminRow {
  id: string;
  slug: string;
  name: string;
  badgeLabel: string | null;
  headline: string | null;
  description: string | null;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  showCountdown: boolean;
  createdAt: string;
  updatedAt: string;
  items: { productId: string; pcts: Record<string, number> }[];
}

/** Студийн сонгогчийн нэг бараа (хуудас серверээс өгнө). */
export interface SaleEventProduct {
  id: string;
  name: string;
  brand: string;
  gender: Gender;
  /** Идэвхтэй, үнэтэй хэмжээнүүд — ml → үндсэн үнэ. */
  prices: Record<number, number>;
}

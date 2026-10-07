"use client";

import type {
  AppliedCoupon,
  CartCollection,
  CartItem,
} from "@/features/cart/store";

/**
 * Төлбөр нь хүлээгдэж буй захиалгын хуулбар (клиент, 2026-10).
 *
 * «Төлбөр төлөх» дармагц захиалга үүсч, захиалсан мөрүүд сагснаас хасагддаг.
 * Төлбөрийн хуудаснаас буцсан хүн хоосон checkout олж, бүгдийг дахин
 * бөглөх ёстой байв. Энэ хуулбараар буцаж ирэхэд мөр, маягт хоёул
 * сэргэнэ; юу ч өөрчлөөгүй бол дахин дарахад ШИНЭ захиалга үүсгэлгүй
 * (нөөц давхар түгжихгүй) өмнөхийнх нь төлбөр рүү шууд орно.
 *
 * localStorage — сесс хаагдсан ч сэргэнэ. Төлөгдсөн / цуцлагдсан бол
 * төлбөрийн хуудас өөрөө цэвэрлэнэ (`clearPendingOrder`).
 */
const KEY = "vonscent-pending-order";

/** Үүнээс хуучин хуулбарыг огт сэргээхгүй — сагс нь өөр түүх болсон. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface PendingOrder<D> {
  payToken: string;
  orderNo: string;
  /** Захиалгын хүсэлтийн биеийн хээ — ижил бол өмнөх захиалгыг дахин ашиглана. */
  signature: string;
  savedAt: number;
  draft: D;
  /** «Захиалах» замаар ирсэн эсэх — тэр мөр сагсанд хэзээ ч ороогүй. */
  buyNow: boolean;
  items: CartItem[];
  collections: CartCollection[];
  coupon: AppliedCoupon | null;
}

/** Хадгалсан мөрийг сагсны `add*` / `startBuyNow*`-ийн аргумент болгоно. */
export function toLineInput<T extends { key: string; qty: number }>(
  line: T,
): [Omit<T, "key" | "qty">, number] {
  const rest: Partial<T> = { ...line };
  delete rest.key;
  delete rest.qty;
  return [rest as Omit<T, "key" | "qty">, line.qty];
}

export function savePendingOrder<D>(order: PendingOrder<D>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(order));
  } catch {
    // Private mode / хориглосон storage — сэргээх боломжгүй ч урсгал таслахгүй.
  }
}

export function readPendingOrder<D>(): PendingOrder<D> | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const order = JSON.parse(raw) as PendingOrder<D>;
    if (!order.payToken || Date.now() - order.savedAt > MAX_AGE_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return order;
  } catch {
    return null;
  }
}

/** `token` өгвөл зөвхөн тэр захиалгынх байвал устгана. */
export function clearPendingOrder(token?: string) {
  try {
    if (token) {
      const raw = localStorage.getItem(KEY);
      if (!raw || (JSON.parse(raw) as { payToken?: string }).payToken !== token)
        return;
    }
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/**
 * Сэргээлтийг зөвхөн «Буцах»-аар ирэхэд хийнэ. Сагснаас «Захиалга
 * үргэлжлүүлэх», эсвэл «Захиалах» дарж ирсэн хүн ШИНЭ сонголттой ирсэн —
 * хуулбар нь түүнийг дарж бичвэл өөр бараа захиалагдана.
 *
 * Тэмдгийг checkout-ийн history entry дээр нь (`history.state`) тавина:
 * буцахад тэр entry өөрийн state-тэйгээ сэргэдэг, харин холбоосоор шинээр
 * ирэхэд шинэ entry тэмдэггүй үүснэ. Next нь өөрийн history бичилтэд
 * хэрэглэгчийн state-ийг хадгалдаг.
 */
const RETURN_KEY = "vonscentPayToken";

export function markReturnPoint(token: string) {
  try {
    window.history.replaceState(
      { ...window.history.state, [RETURN_KEY]: token },
      "",
    );
  } catch {
    // ignore
  }
}

/** Энэ history entry-д тэмдэглэсэн төлбөрийн token (буцаж ирсэн бол). */
export function readReturnPoint(): string | null {
  try {
    const value = (window.history.state as Record<string, unknown> | null)?.[
      RETURN_KEY
    ];
    return typeof value === "string" ? value : null;
  } catch {
    return null;
  }
}

export type PendingStatus = "pending" | "paid" | "cancelled" | "unknown";

/** Төлбөрийн хуудасны poller-ийн ашигладаг endpoint-оос төлөвийг асууна. */
export async function fetchPendingStatus(
  token: string,
): Promise<PendingStatus> {
  try {
    const res = await fetch(
      `/api/payments/status?token=${encodeURIComponent(token)}`,
    );
    if (!res.ok) return "unknown";
    const data = (await res.json()) as { paid?: boolean; cancelled?: boolean };
    if (data.paid) return "paid";
    if (data.cancelled) return "cancelled";
    return "pending";
  } catch {
    return "unknown";
  }
}

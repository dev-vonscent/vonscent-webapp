import {
  buildOrderLines,
  bundleTitle,
  lineBase,
} from "@/lib/orders/order-lines";
import type { PaymentEntry, PaymentLine } from "./types";

/** `paymentLines`-ийн уншдаг `order_items` мөр. */
export interface PaymentItemRow {
  id: string;
  line_no: number | null;
  product_id: string | null;
  product_name: string;
  brand: string;
  ml: number | null;
  qty: number;
  unit_price: number;
  list_price: number | null;
  line_total: number;
  is_sample: boolean;
  is_gift: boolean;
  spin_id: string | null;
  base_price: number | null;
  sale_label: string | null;
  collection_id: string | null;
  collection_name: string | null;
  line_kind: "perfume" | "extra" | "gift_card";
  variant_label: string | null;
  image_url: string | null;
}

/**
 * Захиалгын мөрүүд → `/pay/[token]`, `/order/[token]`-ийн тойм.
 *
 * `lines` — задгай мөрүүд (Purchase analytics), `entries` — тоймд харагдах
 * мөрүүд: «Миний захиалга»-тай ижил `buildOrderLines` (дан ml ↑ → нэмэлт →
 * багц → бэлэг), багц нэг мөр. Мөрийн дүн үндсэн үнэ (`lineBase`) тул
 * нийлбэр нь «Нийт үндсэн үнэ»-тэй таарна.
 */
export function buildPaymentRecap(
  rows: readonly PaymentItemRow[],
  bundles: {
    baseIds: ReadonlySet<string>;
    images: ReadonlyMap<string, string | null>;
  },
  imageById: ReadonlyMap<string, string | null>,
): { lines: PaymentLine[]; entries: PaymentEntry[] } {
  const toLine = (r: PaymentItemRow): PaymentLine => ({
    productId: r.product_id,
    name: r.product_name,
    brand: r.brand,
    ml: r.ml,
    // Бэлгийн карт (0179) ч ml-гүй, загварын нэрээр — нэмэлт бараатай ижил.
    variantLabel: r.line_kind !== "perfume" ? (r.variant_label ?? "") : null,
    isExtra: r.line_kind !== "perfume",
    qty: r.qty,
    lineTotal: r.line_total,
    // Мөр нь үндсэн үнээрээ — багцын хямдрал, арга хэмжээ доор тусдаа мөр
    // болж гарах тул (`lineBase`: хямдралтай дан мөрөнд base_price).
    baseTotal: lineBase(r),
    isSample: r.is_sample,
    isGift: r.is_gift || r.is_sample,
    collectionName: r.collection_name,
    // Нэмэлт бараа зарсан мөчийн зурагтай (0146); үнэртэн барааныхаа зургийг.
    image:
      r.image_url ??
      (r.product_id ? (imageById.get(r.product_id) ?? null) : null),
  });

  const grouped = buildOrderLines(rows, bundles.baseIds);
  const entries: PaymentEntry[] = grouped.map((l) => {
    if (l.kind === "item")
      return { kind: "item", key: l.item.id, line: toLine(l.item) };
    const first = l.members[0];
    return {
      kind: "bundle",
      key: l.key,
      title: bundleTitle(l),
      ml: l.ml,
      qty: l.qty,
      baseTotal: l.base,
      isGift: l.gift,
      // Багцын зураг, эс бөгөөс эхний гишүүнийх.
      image:
        (first.collection_id && bundles.images.get(first.collection_id)) ||
        toLine(first).image,
      members: l.members.map((m) => ({ brand: m.brand, name: m.product_name })),
    };
  });
  // Analytics-ийн задгай мөрүүд ч ижил дараалалтай.
  const lines = grouped
    .flatMap((l) => (l.kind === "bundle" ? l.members : [l.item]))
    .map(toLine);
  return { lines, entries };
}

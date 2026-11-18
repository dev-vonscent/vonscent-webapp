import type { EmailItem } from "@/lib/email/layout";
import { formatPrice } from "@/lib/format";
import { isExtraLine, orderLineMeta } from "@/lib/order-lines";
import {
  buildOrderLines,
  bundleTitle,
  lineBase,
  type OrderLineInput,
} from "@/lib/orders/order-lines";

/** `loadItems`-ийн уншдаг `order_items` мөр. */
export type OrderEmailRow = OrderLineInput & {
  brand: string;
  line_kind: "perfume" | "extra" | "gift_card";
  variant_label: string | null;
};

/**
 * Захиалгын и-мэйлийн мөрүүд — «Миний захиалга»-тай ижил `buildOrderLines`:
 * дан (ml ↑) → нэмэлт → багц (ml ↑) → бэлэг. Багц нэг мөр («NIGHT OUT багц»,
 * «2ml × 1»), гишүүд нь нэрийн доор. Дүн нь үндсэн үнэ — хямдрал тоймд
 * тусдаа мөр тул нийлбэр «Нийт үндсэн үнэ»-тэй таарна. Бэлэгт «Бэлэг».
 */
export function orderEmailItems(
  rows: readonly OrderEmailRow[],
  baseIds: ReadonlySet<string>,
): EmailItem[] {
  const isGift = (r: OrderEmailRow) => r.is_gift || Boolean(r.is_sample);
  return buildOrderLines(rows, baseIds).map((l) => {
    if (l.kind === "bundle") {
      return {
        name: bundleTitle(l),
        meta: `${l.ml}ml × ${l.qty}`,
        amount: l.gift ? "Бэлэг" : formatPrice(l.base),
        members: l.members.map((m) =>
          m.brand ? `${m.brand} — ${m.product_name}` : m.product_name,
        ),
      };
    }
    const r = l.item;
    return {
      // Нэмэлт барааны `brand` нь ангиллын нэр — нэрийн өмнө давхардуулахгүй.
      name: isExtraLine(r)
        ? r.product_name
        : r.brand
          ? `${r.brand} — ${r.product_name}`
          : r.product_name,
      meta: orderLineMeta(r),
      amount: isGift(r) ? "Бэлэг" : formatPrice(lineBase(r)),
    };
  });
}

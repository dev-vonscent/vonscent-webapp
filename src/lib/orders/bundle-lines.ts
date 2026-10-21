/**
 * Захиалгын мөрүүдийг ажилтанд харуулах хэлбэрт — бэлэн (админы, `base`)
 * багцын гишүүд нэг мөр болно: «Gentleman багц · 5ml × 1» (клиент, 2026-10).
 *
 * Багц захиалгад гишүүн бүрээрээ тусдаа мөр болж ордог (0029b: ижил
 * `collection_id`, ижил qty). Хэрэглэгчийн өөрөө угсарсан (`custom`) багц
 * задгай хэвээр — гишүүд нь захиалга бүрд өөр тул ажилтан харах ёстой.
 * Бэлэг мөр хэзээ ч нэгтгэгдэхгүй.
 */

export interface OrderLineInput {
  product_name: string;
  brand: string | null;
  ml: number;
  qty: number;
  unit_price: number;
  list_price: number | null;
  is_gift: boolean;
  collection_id: string | null;
  collection_name: string | null;
}

export type OrderLine<T extends OrderLineInput> =
  | { kind: "item"; item: T }
  | {
      kind: "bundle";
      name: string;
      ml: number;
      /** Хэдэн багц — гишүүдийн qty (бүгд ижил). */
      qty: number;
      /** Хямдралгүй нийт үнэ (гишүүдийн `list_price × qty`). */
      base: number;
      members: T[];
    };

/** `baseCollectionIds` — бэлэн (`type = 'base'`) багцын id-ууд. */
export function groupBundleLines<T extends OrderLineInput>(
  items: readonly T[],
  baseCollectionIds: ReadonlySet<string>,
): OrderLine<T>[] {
  const out: OrderLine<T>[] = [];
  const bundles = new Map<string, Extract<OrderLine<T>, { kind: "bundle" }>>();
  for (const item of items) {
    const id = item.collection_id;
    if (!id || item.is_gift || !baseCollectionIds.has(id)) {
      out.push({ kind: "item", item });
      continue;
    }
    // Нэг багцыг хоёр хэмжээгээр авсан бол тусдаа мөр.
    const key = `${id}:${item.ml}`;
    const base = (item.list_price ?? item.unit_price) * item.qty;
    const existing = bundles.get(key);
    if (existing) {
      existing.qty = Math.max(existing.qty, item.qty);
      existing.base += base;
      existing.members.push(item);
      continue;
    }
    const line = {
      kind: "bundle" as const,
      name: item.collection_name ?? "Багц",
      ml: item.ml,
      qty: item.qty,
      base,
      members: [item],
    };
    bundles.set(key, line);
    out.push(line);
  }
  return out;
}

/** Мөрүүдийн багцын id-ууд — `type`-ийг нь уншихад. */
export function collectionIdsOf(items: readonly OrderLineInput[]): string[] {
  return [
    ...new Set(
      items.map((i) => i.collection_id).filter((id): id is string => !!id),
    ),
  ];
}

import { spraysText, type SizeOption } from "@/features/products/size-options";
import { bundleSaleEndsAt } from "./pricing";
import type { CollectionCardData, CollectionPriceAtMl } from "./types";

/**
 * Бэлэн багцын хэмжээнүүд → нэгдсэн хэмжээ сонгогчийн карт (task 15).
 * Карт дээр «5ml ×4» + «тус бүр 75 цацалт».
 *
 * - Бүх гишүүнд энэ хэмжээ БАЙГАА ч аль нэг нь дууссан → «Дууссан», СОНГОГДОНО
 *   (task 4 — үнэ нь бүрэн, дээр харагдана; товч идэвхгүй).
 * - Аль нэг гишүүнд энэ хэмжээ огт байхгүй (зарахгүй) → «Байхгүй»,
 *   сонгогдохгүй: үнэ нь дутуу нийлбэр болох тул харуулах ёсгүй.
 * - Хямдралын тэмдэг (2.6) зөвхөн арга хэмжээ ЭНЭ хэмжээнд нэмэлт хэмнэлт
 *   өгч байвал (`eventSaving`). Суурь багцын хувь бүх хэмжээнд байнга
 *   байдаг тул тэмдэглэвэл бүгд тэмдэгтэй болж утгаа алдана.
 */
export function bundleSizeOptions(
  collection: Pick<CollectionCardData, "members" | "prices">,
): SizeOption[] {
  const count = collection.members.length;
  return collection.prices.map((p) => {
    const complete =
      count > 0 && collection.members.every((m) => m.variantByMl[p.ml] != null);
    return {
      id: String(p.ml),
      ml: p.ml,
      label: `${p.ml}ml ×${count}`,
      note: p.available ? null : complete ? "Дууссан" : "Байхгүй",
      selectable: p.available || complete,
      buyable: p.available,
      // Үнийн хэсэгтэй ижил: админы амласан хувь (event үед event-ийн).
      salePct: (p.eventSaving ?? 0) > 0 ? p.nominalDiscountPct : 0,
      sprays: spraysText(p.ml, true),
      price: p.price,
      totalMl: p.ml * Math.max(count, 1),
    };
  });
}

/**
 * Сонгосон хэмжээний тоолуурын мөч: арга хэмжээ ЭНЭ хэмжээнд хэмнэлт өгч
 * байвал л (`eventSaving` > 0 — event хувь ≤ суурь хувь бол үгүй,
 * `bundleSaleEndsAt`-ийн дүрэм хэмжээ тус бүрээр). Суурь хувь хугацаагүй.
 */
export function bundleSizeSaleEndsAt(
  collection: Pick<CollectionCardData, "event">,
  priceRow: Pick<CollectionPriceAtMl, "eventSaving"> | null | undefined,
): string | null {
  if (!priceRow || !((priceRow.eventSaving ?? 0) > 0)) return null;
  return bundleSaleEndsAt(collection);
}

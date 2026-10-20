import type { ShopExtraCard } from "../types";

/**
 * Хоосон/бүтэн шилний хэмжээ (plan §18.5): хоосон шил «0/125ml», «Шилтэй
 * ус»-ны бүтэн шил «100/100ml». Үлдэгдэлтэй шил өөрийн ≈ml-тэй тул энд биш.
 */
export function bottleSizeText(
  card: Pick<ShopExtraCard, "bottleMl" | "categorySlug" | "mode">,
): string | null {
  if (card.bottleMl == null || card.mode !== "local_quantity") return null;
  const filled = card.categorySlug === "empty-bottle" ? 0 : card.bottleMl;
  return `${filled}/${card.bottleMl}ml`;
}

/**
 * Хэрэглэгчид харагдах үлдэгдэл (§18.5): «Үлдэгдэл: 6 ширхэг», дууссан бол
 * «Үлдэгдэлгүй». Үлдэгдэлтэй шил («Ганц ширхэг») ба тоолоогүй сав — null.
 */
export function stockText(
  card: Pick<ShopExtraCard, "mode" | "stock" | "soldOut">,
): string | null {
  if (card.mode === "leftover_liquid") return null;
  if (card.soldOut || card.stock === 0) return "Үлдэгдэлгүй";
  if (card.stock == null) return null;
  return `Үлдэгдэл: ${card.stock} ширхэг`;
}

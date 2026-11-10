import { EXTRAS_LOW_STOCK_QTY } from "@/lib/constants";
import type { ShopExtraCard } from "../types";
import { bottleKind } from "./bottle-kind";

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
 * Картын/хуудасны дээрх жижиг бичиг: эх үнэртэнтэй шилэнд брэнд (шилний гол
 * таних тэмдэг — «Үнэртний шил» хуудсанд tab нь төрлийг аль хэдийн хэлдэг),
 * холбоогүй лацтай шилэнд «Бүтэн шил» («Шилтэй ус» ангилал нь хоёр горимтой —
 * нэр нь бүтэн эсэхийг хэлдэггүй), бусадд ангиллын нэр.
 */
export function eyebrowText(
  card: Pick<
    ShopExtraCard,
    "leftover" | "perfume" | "categorySlug" | "categoryName" | "mode"
  >,
): string {
  const kind = bottleKind(card.categorySlug, card.mode);
  const brand = card.leftover?.brand || (kind ? card.perfume?.brand : null);
  if (brand) return brand;
  if (kind === "sealed") return "Бүтэн шил";
  return card.categoryName;
}

/**
 * Ангилал/брэнд нь барааны нэртэйгээ ижил үү («Шприц» ангиллын «Шприц») —
 * eyebrow, breadcrumb-д давтахгүй.
 */
export function repeatsName(label: string, name: string): boolean {
  return label.trim().toLowerCase() === name.trim().toLowerCase();
}

/**
 * Картын үлдэгдэл: зөвхөн цөөн үлдсэн үед «Сүүлийн 2 ширхэг», дууссан бол
 * «Дууссан». «Үлдэгдэл: 210 ширхэг» хэрэглэгчид юу ч хэлэхгүй, үнэртний
 * карттай хэмнэлийг эвддэг байв — бүтэн тоо барааны хуудсанд (§18.5).
 * Үлдэгдэлтэй шил («Ганц ширхэг») ба тоолоогүй сав — null.
 */
export function stockText(
  card: Pick<ShopExtraCard, "mode" | "stock" | "soldOut">,
): string | null {
  if (card.mode === "leftover_liquid") return null;
  if (card.soldOut || card.stock === 0) return "Дууссан";
  if (card.stock == null || card.stock > EXTRAS_LOW_STOCK_QTY) return null;
  return `Сүүлийн ${card.stock} ширхэг`;
}

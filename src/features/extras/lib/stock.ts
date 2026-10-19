import { EXTRAS_LOW_STOCK_QTY } from "@/lib/constants";
import type { AdminExtra, AdminExtraVariant, ShopExtraCard } from "../types";

export type StockTone = "ok" | "low" | "out" | "muted";

/**
 * Жагсаалтын нөөцийн шошго. Өнгө дангаараа биш — текст нь өөрөө хэлнэ
 * (design.md §9): «Дууссан», «Цөөхөн: 2», «Захиалгад орсон».
 */
export function extraStockLabel(extra: AdminExtra): {
  label: string;
  tone: StockTone;
} {
  if (extra.mode === "leftover_liquid") {
    switch (extra.leftover?.lockState) {
      case "listed":
        return { label: "Зарагдаж буй", tone: "ok" };
      case "reserved":
        return { label: "Захиалгад орсон", tone: "low" };
      case "committed":
        return { label: "Зарагдсан", tone: "muted" };
      default:
        return { label: "Нийтлээгүй", tone: "muted" };
    }
  }
  const active = extra.variants.filter((v) => v.isActive);
  if (active.length === 0) return { label: "Хувилбаргүй", tone: "muted" };
  if (active.some((v) => v.available == null)) {
    return { label: "Тоо оруулаагүй", tone: "muted" };
  }
  const total = active.reduce((n, v) => n + (v.available ?? 0), 0);
  if (total <= 0) return { label: "Дууссан", tone: "out" };
  const low = active.filter((v) => (v.available ?? 0) <= EXTRAS_LOW_STOCK_QTY);
  if (low.length > 0) {
    const min = Math.min(...low.map((v) => v.available ?? 0));
    return { label: `Цөөхөн үлдсэн: ${min} ширхэг`, tone: "low" };
  }
  return { label: `${total} ширхэг`, tone: "ok" };
}

/** Хувилбар одоо зарагдах уу (идэвхтэй + үлдэгдэлтэй/хязгааргүй). */
export function variantSellable(v: AdminExtraVariant): boolean {
  return v.isActive && v.price > 0 && (v.available == null || v.available > 0);
}

/** Админы мөрийг дэлгүүрийн карт болгоно — «Дэлгүүрт ингэж харагдана». */
export function adminToShopCard(extra: AdminExtra): ShopExtraCard {
  const active = extra.variants.filter((v) => v.isActive);
  const sellable = active.filter(variantSellable);
  const prices = (sellable.length ? sellable : active).map((v) => v.price);
  const leftover = extra.leftover;
  return {
    id: extra.id,
    slug: extra.slug,
    name: extra.name,
    categoryName: extra.categoryName,
    categorySlug: extra.categorySlug,
    mode: extra.mode,
    image: extra.images[0] ?? leftover?.productImage ?? null,
    fromPrice: prices.length ? Math.min(...prices) : 0,
    soldOut:
      extra.mode === "leftover_liquid"
        ? leftover?.lockState === "committed" ||
          leftover?.lockState === "reserved"
        : sellable.length === 0,
    leftover: leftover
      ? {
          brand: leftover.productBrand,
          productName: leftover.productName,
          remainingMl: leftover.remainingMl,
          fullMl: leftover.fullMl,
        }
      : null,
    capacity: extra.capacity,
  };
}

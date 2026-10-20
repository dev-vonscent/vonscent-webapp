import { normalizeSearchText } from "@/lib/search";
import type { ShopExtraCard } from "../types";

/** Үнэртний шил — дэлгүүрт дагалдах хэрэгслийн доор тусдаа бүлэг. */
const BOTTLE_CATEGORIES = new Set(["bottled", "empty-bottle"]);

export const isBottleCategory = (slug: string) => BOTTLE_CATEGORIES.has(slug);

/** «Нэмэлт бараа» табын шүүлтүүр — URL: `cat` (таслалаар), `q`, `stock=1`. */
export interface ExtraFilters {
  cats: string[];
  q: string;
  inStock: boolean;
}

export function parseExtraFilters(params: URLSearchParams): ExtraFilters {
  return {
    cats: (params.get("cat") ?? "").split(",").filter(Boolean),
    q: (params.get("q") ?? "").trim(),
    inStock: params.get("stock") === "1",
  };
}

export function filterExtras<
  T extends Pick<
    ShopExtraCard,
    "name" | "categoryName" | "categorySlug" | "soldOut" | "leftover"
  >,
>(items: readonly T[], f: ExtraFilters): T[] {
  const q = normalizeSearchText(f.q);
  return items.filter(
    (e) =>
      (f.cats.length === 0 || f.cats.includes(e.categorySlug)) &&
      (!f.inStock || !e.soldOut) &&
      (!q ||
        normalizeSearchText(
          [e.name, e.categoryName, e.leftover?.brand, e.leftover?.productName]
            .filter(Boolean)
            .join(" "),
        ).includes(q)),
  );
}

import { matchesSearch } from "@/lib/search";
import type { CatalogFilters } from "@/lib/types";
import type { Collection } from "./types";

/**
 * Каталогийн шүүлтүүрийг багцад үйлчлүүлнэ — ус, багц нэг дүрмээр шүүгдэнэ
 * (клиент, 2026-10: таг дээр гараад брэнд/үнэ сонгоход алга болдог байсан).
 *
 * - Хүйс: багцын хүйс (`gender` нь `expandGenders`-ээр өргөссөн байх ёстой).
 * - Брэнд / үнэрийн төрөл / улирал: аль нэг гишүүн нь таарвал.
 * - Таг: автомат «Эрэлттэй»/«Шинэ»; «Хямдрал» багцад хамаарахгүй
 *   (клиент, 2026-09-30) — зөвхөн «Хямдрал» сонговол багц гарахгүй.
 * - Үнэ: картанд харагддаг «-өөс» үнээр (ус ч `startingPrice`-аараа);
 *   дууссан багц `catalogPrice`-аар.
 * - Хэмжээ: тэр хэмжээгээр бүтэн багц авч болох бол.
 * - Хайлт: багцын нэр, гишүүдийн нэр, брэнд.
 * Дууссан багц ч усны адил гарна («Түр байхгүй»), эрэмбэд ард нь.
 */
export function filterCatalogCollections(
  all: readonly Collection[],
  f: CatalogFilters,
): Collection[] {
  return all.filter((c) => {
    if (f.gender?.length && !f.gender.includes(c.gender)) return false;
    if (f.brand?.length && !c.members.some((m) => f.brand!.includes(m.brand)))
      return false;
    if (
      f.family?.length &&
      !c.members.some((m) => m.scentFamilies.some((x) => f.family!.includes(x)))
    )
      return false;
    if (
      f.season?.length &&
      !c.members.some(
        (m) =>
          m.seasons.includes("all") ||
          m.seasons.some((s) => f.season!.includes(s)),
      )
    )
      return false;
    if (
      f.tags?.length &&
      !f.tags.some((t) => t !== "sale" && c.tags.includes(t))
    )
      return false;
    if (f.featured && !c.isFeatured) return false;
    if (f.ml?.length && !c.availableMls.some((ml) => f.ml!.includes(ml)))
      return false;
    if (f.minPrice != null && catalogPrice(c) < f.minPrice) return false;
    if (f.maxPrice != null && catalogPrice(c) > f.maxPrice) return false;
    if (f.search) {
      const haystack = [
        c.name,
        ...c.members.flatMap((m) => [m.name, m.brand]),
      ].join(" ");
      if (!matchesSearch(haystack, f.search)) return false;
    }
    return true;
  });
}

/**
 * Үнийн шүүлт/эрэмбийн үнэ. Дууссан багцын `startingPrice` нь 0 — тэгвэл
 * хамгийн бага хэмжээний үнэ (ус ч дууссан үедээ идэвхтэй хэмжээний үнээр
 * эрэмбэлэгддэг, 0058 `catalog_facets`).
 */
export function catalogPrice(c: Collection): number {
  if (c.startingPrice > 0) return c.startingPrice;
  const prices = c.prices.map((p) => p.price).filter((p) => p > 0);
  return prices.length ? Math.min(...prices) : 0;
}

/**
 * Каталогийн эрэмбийг (`sortProducts`-ийн толь) багцад хэрэглэнэ. Үнэ/нэрийн
 * эрэмбээс бусдад дууссан нь ард — эдгээрт багц эхний мөрүүдэд ээлжилдэг
 * (`mixCatalog`) тул «Түр байхгүй» багц жагсаалтын оройд гарах ёсгүй.
 */
export function sortCatalogCollections(
  cs: readonly Collection[],
  sort: CatalogFilters["sort"] = "new",
): Collection[] {
  const copy = [...cs];
  const byStock = (a: Collection, b: Collection) =>
    Number(a.soldOut) - Number(b.soldOut);
  const newest = (a: Collection, b: Collection) =>
    b.createdAt.localeCompare(a.createdAt);
  switch (sort) {
    case "price_asc":
      return copy.sort((a, b) => catalogPrice(a) - catalogPrice(b));
    case "price_desc":
      return copy.sort((a, b) => catalogPrice(b) - catalogPrice(a));
    case "name":
      return copy.sort((a, b) => a.name.localeCompare(b.name));
    case "popular":
      return copy.sort(
        (a, b) =>
          byStock(a, b) ||
          Number(b.tags.includes("hot")) - Number(a.tags.includes("hot")) ||
          newest(a, b),
      );
    case "recommended": {
      const tier = (c: Collection) =>
        c.tags.includes("hot")
          ? 0
          : c.tags.includes("new")
            ? 1
            : c.isFeatured
              ? 2
              : 3;
      return copy.sort(
        (a, b) =>
          byStock(a, b) || tier(a) - tier(b) || a.name.localeCompare(b.name),
      );
    }
    default:
      return copy.sort((a, b) => byStock(a, b) || newest(a, b));
  }
}

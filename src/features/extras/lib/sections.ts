import { normalizeSearchText } from "@/lib/search";
import type { ShopExtraCard } from "../types";
import { type BottleKind, bottleKind } from "./bottle-kind";

/**
 * Нэмэлт бараа дэлгүүрт ХОЁР хуудсанд хуваагдана (extras-shop-plan §19):
 *
 *   bottles     «Үнэртний шил» — тодорхой үнэртний шил (бүтэн, үлдэгдэлтэй,
 *               хоосон). Брэнд, нэрээр хайдаг, тоо нь өснө.
 *   accessories «Дагалдах хэрэгсэл» — бэлгийн сав, грамын сав, шприц. Цөөн,
 *               зорилгоор авдаг.
 *
 * Ангилал/горимоос гарна — schema-д хуудасны багана байхгүй. Шинэ ангилал
 * `bottleKind`-д ороогүй л бол «Дагалдах хэрэгсэл»-д унана.
 */
export type ExtraSection = "bottles" | "accessories";

export const EXTRA_SECTION: Record<
  ExtraSection,
  { href: string; title: string; hint: string }
> = {
  bottles: {
    href: "/bottles",
    title: "Үнэртний шил",
    hint: "Бүтэн, үлдэгдэлтэй, хоосон шил",
  },
  accessories: {
    href: "/accessories",
    title: "Дагалдах хэрэгсэл",
    hint: "Бэлгийн сав, грамын сав, шприц",
  },
};

export function extraSection(
  card: Pick<ShopExtraCard, "categorySlug" | "mode">,
): ExtraSection {
  return bottleKind(card.categorySlug, card.mode) ? "bottles" : "accessories";
}

/**
 * «Үнэртний шил»-ийн tab — дараалал нь дэлгэцийн дараалал. Бүтэн шил үнэ
 * цэнээрээ эхэнд, хоосон шил тоогоороо их боловч сүүлд.
 */
export const BOTTLE_TABS: readonly BottleKind[] = [
  "sealed",
  "leftover",
  "empty",
];

export const BOTTLE_TAB_LABEL: Record<BottleKind, string> = {
  sealed: "Бүтэн шил",
  leftover: "Үлдэгдэлтэй",
  empty: "Хоосон шил",
};

/** Холимог жагсаалт дахь (нүүр, үнэртний хуудас) картын төрлийн badge. */
export const BOTTLE_BADGE: Record<BottleKind, string> = {
  sealed: "Бүтэн",
  leftover: "Үлдэгдэлтэй",
  empty: "Хоосон",
};

export function isBottleTab(v: unknown): v is BottleKind {
  return (BOTTLE_TABS as readonly unknown[]).includes(v);
}

/** URL-ийн tab; байхгүй/буруу бол бараатай эхний tab. */
export function resolveBottleTab(
  requested: string | null,
  counts: Record<BottleKind, number>,
): BottleKind | null {
  if (isBottleTab(requested) && counts[requested] > 0) return requested;
  return BOTTLE_TABS.find((t) => counts[t] > 0) ?? null;
}

export function countBottleTabs(
  items: readonly Pick<ShopExtraCard, "categorySlug" | "mode">[],
): Record<BottleKind, number> {
  const counts: Record<BottleKind, number> = {
    sealed: 0,
    leftover: 0,
    empty: 0,
  };
  for (const i of items) {
    const kind = bottleKind(i.categorySlug, i.mode);
    if (kind) counts[kind]++;
  }
  return counts;
}

/** Брэнд + тоо, олноос цөөн рүү (тэнцвэл үсгээр) — chip мөр, sidebar. */
export function brandCounts(
  items: readonly Pick<ShopExtraCard, "perfume">[],
): { brand: string; count: number }[] {
  const out = new Map<string, number>();
  for (const i of items) {
    const b = i.perfume?.brand;
    if (b) out.set(b, (out.get(b) ?? 0) + 1);
  }
  return [...out]
    .map(([brand, count]) => ({ brand, count }))
    .sort((a, b) => b.count - a.count || a.brand.localeCompare(b.brand));
}

/**
 * Шилний эх үнэртний шинж (0176 `extras_bottle_facets`) — бүтэн, үлдэгдэлтэй
 * шилийг каталогтой ижил хүйс / үнэрийн төрөл / улирлаар шүүнэ.
 */
export interface BottleFacets {
  gender: string | null;
  families: string[];
  seasons: string[];
}

/**
 * Каталог маягийн шүүлтүүртэй tab — дотор нь үнэртэн бий. Хоосон шилэнд
 * хүйс, ноот хамаагүй (цуглуулгын эд) тул брэнд л.
 */
export const FACET_TABS: readonly BottleKind[] = ["sealed", "leftover"];

/** Tab солиход цэвэрлэх түлхүүр: үнийн муж tab бүрт өөр, шинж хоосон шилэнд байхгүй. */
export const TAB_SCOPED_KEYS = [
  "gender",
  "family",
  "season",
  "minPrice",
  "maxPrice",
] as const;

/**
 * «Үнэртний шил»-ийн шүүлт — URL нь каталогийнхтай ижил түлхүүр:
 * `brand`, `gender`, `family`, `season` (таслалаар), `minPrice`, `maxPrice`,
 * `q`, `stock=1`.
 */
export interface BottleFilters {
  brands: string[];
  genders: string[];
  families: string[];
  seasons: string[];
  minPrice: number | null;
  maxPrice: number | null;
  q: string;
  inStock: boolean;
}

export function parseBottleFilters(params: URLSearchParams): BottleFilters {
  const list = (k: string) => (params.get(k) ?? "").split(",").filter(Boolean);
  const num = (k: string) => {
    const n = Number(params.get(k));
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  return {
    brands: list("brand"),
    genders: list("gender"),
    families: list("family"),
    seasons: list("season"),
    minPrice: num("minPrice"),
    maxPrice: num("maxPrice"),
    q: (params.get("q") ?? "").trim(),
    inStock: params.get("stock") === "1",
  };
}

const overlaps = (a: readonly string[], b: readonly string[]) =>
  a.some((x) => b.includes(x));

export function filterBottles<
  T extends Pick<
    ShopExtraCard,
    "name" | "perfume" | "soldOut" | "fromPrice"
  > & {
    facets?: BottleFacets | null;
  },
>(items: readonly T[], f: BottleFilters): T[] {
  const q = normalizeSearchText(f.q);
  return items.filter((e) => {
    const fx = e.facets;
    return (
      (f.brands.length === 0 ||
        (e.perfume != null && f.brands.includes(e.perfume.brand))) &&
      (f.genders.length === 0 ||
        (fx?.gender != null && f.genders.includes(fx.gender))) &&
      (f.families.length === 0 ||
        (fx != null && overlaps(fx.families, f.families))) &&
      // Каталогтой ижил (0115): «Бүх улирал»-ын үнэр дан улиралд ч тохирно.
      (f.seasons.length === 0 ||
        (fx != null && overlaps(fx.seasons, [...f.seasons, "all"]))) &&
      (f.minPrice == null || e.fromPrice >= f.minPrice) &&
      (f.maxPrice == null || e.fromPrice <= f.maxPrice) &&
      (!f.inStock || !e.soldOut) &&
      (!q ||
        normalizeSearchText(
          [e.name, e.perfume?.brand, e.perfume?.name].filter(Boolean).join(" "),
        ).includes(q))
    );
  });
}

/**
 * Хуучин `/extras?cat=…` (мөн `/catalog?tab=extras&cat=…`) холбоосын шинэ
 * хаяг. Шилний ангилал бол «Үнэртний шил», бусад нь «Дагалдах хэрэгсэл»;
 * `q`, `sort`, `stock` дагана. Дагалдах хэрэгсэл нэг grid тул `cat` хаягдана.
 */
export function legacyExtrasHref(
  params: Record<string, string | string[] | undefined>,
): string {
  const one = (k: string) => {
    const v = params[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const cats = (one("cat") ?? "").split(",").filter(Boolean);
  const bottleCats = cats.filter(
    (c) => c === "empty-bottle" || c === "bottled",
  );
  const toBottles = cats.length > 0 && bottleCats.length === cats.length;
  const next = new URLSearchParams();
  if (toBottles && bottleCats.length === 1 && bottleCats[0] === "empty-bottle")
    next.set("type", "empty");
  for (const k of toBottles ? ["q", "sort", "stock"] : []) {
    const v = one(k);
    if (v) next.set(k, v);
  }
  const base = EXTRA_SECTION[toBottles ? "bottles" : "accessories"].href;
  return `${base}${next.size ? `?${next}` : ""}`;
}

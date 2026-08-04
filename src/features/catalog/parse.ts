import type { CatalogFilters } from "@/lib/types";
import type { Gender, ScentFamily, Season, TagKind } from "@/db/types";
import { GENDERS, ML_SIZES, SEASONS } from "@/lib/constants";

type Params = Record<string, string | string[] | undefined>;

function list(v: string | string[] | undefined): string[] {
  if (!v) return [];
  const arr = Array.isArray(v) ? v : v.split(",");
  return arr.map((s) => s.trim()).filter(Boolean);
}

const TAGS: TagKind[] = ["new", "hot", "sale"];
const SORTS = ["new", "price_asc", "price_desc", "name", "popular"] as const;

/** Parse Next.js searchParams into typed catalog filters. */
export function parseFilters(params: Params): CatalogFilters {
  const gender = list(params.gender).filter((g): g is Gender =>
    (GENDERS as readonly string[]).includes(g),
  );
  // Families are admin-managed slugs, so there is no closed list to validate
  // against here — accept anything slug-shaped; an unknown slug simply matches
  // no products.
  const family = list(params.family).filter((f): f is ScentFamily =>
    /^[a-z0-9-]+$/.test(f),
  );
  const season = list(params.season).filter((s): s is Season =>
    (SEASONS as readonly string[]).includes(s),
  );
  const tags = list(params.tags).filter((t): t is TagKind =>
    TAGS.includes(t as TagKind),
  );
  const ml = list(params.ml)
    .map(Number)
    .filter((n) => (ML_SIZES as readonly number[]).includes(n));

  const sortRaw = typeof params.sort === "string" ? params.sort : "new";
  const sort = (SORTS as readonly string[]).includes(sortRaw)
    ? (sortRaw as CatalogFilters["sort"])
    : "new";

  const num = (v: string | string[] | undefined) => {
    const n = Number(Array.isArray(v) ? v[0] : v);
    return Number.isFinite(n) ? n : undefined;
  };

  return {
    brand: list(params.brand),
    gender,
    family,
    season,
    tags,
    ml,
    minPrice: num(params.minPrice),
    maxPrice: num(params.maxPrice),
    search: typeof params.q === "string" ? params.q : undefined,
    sort,
    page: Math.max(1, num(params.page) ?? 1),
  };
}

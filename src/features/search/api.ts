import "server-only";
import { createPublicClient } from "@/lib/supabase/public";
import { callRpc } from "@/lib/supabase/rpc";
import { SEARCH_LIMIT_PER_KIND, SEARCH_PRODUCT_LIMIT } from "@/lib/constants";
import { isSearchable, matchesSearch, searchTerms } from "@/lib/search";
import { SEED_PRODUCTS } from "@/features/products/seed";
import {
  EMPTY_SEARCH_RESULTS,
  type SearchHit,
  type SearchKind,
  type SearchResults,
} from "./types";

/**
 * Глобал хайлт (backlog H1).
 *
 * Шүүлт БҮХЭЛДЭЭ өгөгдлийн санд хийгдэнэ: `global_search()` RPC нэг дуудлагаар
 * бараа / багц / блог / брэндийг trigram индексээр хайж, эрэмбэлж буцаана
 * (0057_search.sql). Өмнө нь хайлт бүр бүх каталогийг санах ойд ачаалж JS
 * дотор шүүдэг байсан — бараа нэмэгдэх тусам удаашрахаас гадна зөвхөн бараа
 * олддог байв.
 *
 * Багц нь өөрийн нэрээс гадна ГИШҮҮН барааныхаа нэр/брэндээр ч олдоно
 * (0081_collection_search_members) — «creed» гэж хайхад Creed-ийн үнэртнүүдийн
 * дараа Creed орсон preset багцууд гарна.
 *
 * Хайх үгийг ЭНД хэвийн болгож (`normalizeSearchText`) SQL руу дамжуулна;
 * баганын текст нь Postgres талдаа `search_normalize()`-ээр хадгалагдсан
 * байдаг. Хоёр функцийн паритетыг `scripts/check-search-parity.ts` шалгана.
 */

interface SearchRow {
  kind: SearchKind;
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  price: number | null;
  sold_out: boolean;
  item_count: number | null;
  member_images: string[] | null;
}

function hrefFor(row: SearchRow): string {
  switch (row.kind) {
    case "product":
      return `/products/${row.slug}`;
    case "collection":
      return `/collections/${row.slug}`;
    case "extra":
      return `/extras/${row.slug}`;
    case "post":
      return `/blog/${row.slug}`;
    // Брэнд нь өөрийн хуудасгүй — каталогийн шүүлт рүү аваачна. Каталог нь
    // брэндийг НЭРЭЭР нь шүүдэг (products.brand), slug-аар биш.
    case "brand":
      return `/catalog?brand=${encodeURIComponent(row.title)}`;
  }
}

function toHit(row: SearchRow): SearchHit {
  return {
    kind: row.kind,
    id: row.id,
    href: hrefFor(row),
    title: row.title,
    subtitle: row.subtitle,
    imageUrl: row.image_url,
    price: row.price,
    soldOut: row.sold_out,
    itemCount: row.item_count,
    memberImages: row.member_images,
  };
}

/**
 * Төрөл бүрийн хязгаар. `limit` өгөөгүй (глобал панель) бол бараа
 * `SEARCH_PRODUCT_LIMIT`, бусад нь `SEARCH_LIMIT_PER_KIND`; өгсөн бол бүх
 * төрөлд ижил. 1…20 мужид хавчина.
 */
export function searchLimits(limit?: number): {
  product: number;
  other: number;
} {
  const clamp = (n: number) => Math.min(Math.max(Math.trunc(n), 1), 20);
  return limit === undefined
    ? {
        product: clamp(SEARCH_PRODUCT_LIMIT),
        other: clamp(SEARCH_LIMIT_PER_KIND),
      }
    : { product: clamp(limit), other: clamp(limit) };
}

export async function globalSearch(
  query: string,
  limit?: number,
): Promise<SearchResults> {
  if (!isSearchable(query)) return EMPTY_SEARCH_RESULTS;
  const terms = searchTerms(query);
  const limits = searchLimits(limit);

  const supabase = createPublicClient();
  if (!supabase) return seedSearch(query, limits.product);

  const { data, error } = await callRpc<SearchRow[]>(
    supabase,
    "global_search",
    {
      p_terms: terms,
      // RPC нэг хязгаартай — хамгийн томоор авч, төрөл бүрийг доор таслана.
      p_limit: Math.max(limits.product, limits.other),
    },
  );
  if (error || !data) return EMPTY_SEARCH_RESULTS;

  const results: SearchResults = {
    product: [],
    collection: [],
    extra: [],
    post: [],
    brand: [],
  };
  for (const row of data) {
    // Блог хуудас нуугдсан тул нийтлэлийн үр дүнг харуулахгүй (RPC-г нь
    // хэвээр үлдээв: хуудсыг эргүүлж нээхэд энэ шүүлтийг л авна).
    if (row.kind === "post") continue;
    // RPC эрэмбэлж өгсөн — дараалал нь хэвээр.
    const bucket = results[row.kind];
    const max = row.kind === "product" ? limits.product : limits.other;
    if (bucket && bucket.length < max) bucket.push(toHit(row));
  }
  return results;
}

/**
 * Supabase тохируулаагүй үед (demo) seed өгөгдлөөс хайна. Багц, брэнд нь
 * зөвхөн санд байдаг тул demo-д хоосон.
 */
function seedSearch(query: string, limitPerKind: number): SearchResults {
  const products = SEED_PRODUCTS.filter((p) =>
    matchesSearch(`${p.name} ${p.brand} ${p.customTags.join(" ")}`, query),
  ).slice(0, limitPerKind);
  return {
    product: products.map((p) => ({
      kind: "product",
      id: p.id,
      href: `/products/${p.slug}`,
      title: p.name,
      subtitle: p.brand,
      imageUrl: p.image?.url ?? null,
      price: p.startingPrice,
      soldOut: p.soldOut,
      itemCount: null,
      memberImages: null,
    })),
    collection: [],
    extra: [],
    post: [],
    brand: [],
  };
}

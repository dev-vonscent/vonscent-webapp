import "server-only";
import { createPublicClient } from "@/lib/supabase/public";
import { callRpc } from "@/lib/supabase/rpc";
import { SEARCH_LIMIT_PER_KIND } from "@/lib/constants";
import { isSearchable, matchesSearch, searchTerms } from "@/lib/search";
import { SEED_PRODUCTS } from "@/features/products/seed";
import { BLOG_POSTS } from "@/features/blog/seed";
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
}

function hrefFor(row: SearchRow): string {
  switch (row.kind) {
    case "product":
      return `/products/${row.slug}`;
    case "collection":
      return `/collections/${row.slug}`;
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
  };
}

export async function globalSearch(
  query: string,
  limitPerKind: number = SEARCH_LIMIT_PER_KIND,
): Promise<SearchResults> {
  if (!isSearchable(query)) return EMPTY_SEARCH_RESULTS;
  const terms = searchTerms(query);

  const supabase = createPublicClient();
  if (!supabase) return seedSearch(query, limitPerKind);

  const { data, error } = await callRpc<SearchRow[]>(
    supabase,
    "global_search",
    {
      p_terms: terms,
      p_limit: Math.min(Math.max(limitPerKind, 1), 20),
    },
  );
  if (error || !data) return EMPTY_SEARCH_RESULTS;

  const results: SearchResults = {
    product: [],
    collection: [],
    post: [],
    brand: [],
  };
  for (const row of data) {
    // RPC эрэмбэлж өгсөн — дараалал нь хэвээр.
    results[row.kind]?.push(toHit(row));
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
  const posts = BLOG_POSTS.filter((p) =>
    matchesSearch(`${p.title} ${p.excerpt} ${p.category}`, query),
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
    })),
    collection: [],
    post: posts.map((p) => ({
      kind: "post",
      id: p.slug,
      href: `/blog/${p.slug}`,
      title: p.title,
      subtitle: p.category || null,
      imageUrl: p.cover,
      price: null,
      soldOut: false,
      itemCount: null,
    })),
    brand: [],
  };
}

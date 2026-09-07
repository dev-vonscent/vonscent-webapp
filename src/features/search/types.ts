/** Глобал хайлтын үр дүнгийн төрлүүд (backlog H1). */
export const SEARCH_KINDS = ["product", "collection", "post", "brand"] as const;
export type SearchKind = (typeof SEARCH_KINDS)[number];

/** Төрөл бүрийн бүлгийн гарчиг — үр дүн бүлэглэж харагдана (H1.4). */
export const SEARCH_KIND_LABEL: Record<SearchKind, string> = {
  product: "Үнэртэн",
  collection: "Багц",
  post: "Нийтлэл",
  brand: "Брэнд",
};

/** Нэг илэрц — дөрвөн төрөл нэг л хэлбэрт багтана. */
export interface SearchHit {
  kind: SearchKind;
  id: string;
  /** Дарахад очих зам. */
  href: string;
  title: string;
  /** Барааны брэнд, нийтлэлийн ангилал — байхгүй бол null. */
  subtitle: string | null;
  imageUrl: string | null;
  /** Зөвхөн бараа: «-аас эхлэх» үнэ (₮). */
  price: number | null;
  soldOut: boolean;
  /** Багцын гишүүдийн тоо, брэндийн барааны тоо. */
  itemCount: number | null;
}

/** Төрлөөр нь бүлэглэсэн үр дүн — UI SEARCH_KINDS дарааллаар харуулна. */
export type SearchResults = Record<SearchKind, SearchHit[]>;

export const EMPTY_SEARCH_RESULTS: SearchResults = {
  product: [],
  collection: [],
  post: [],
  brand: [],
};

export function totalHits(results: SearchResults): number {
  return SEARCH_KINDS.reduce((n, k) => n + results[k].length, 0);
}

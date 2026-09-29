/**
 * Review shapes shared by the server data layer (`api.ts`, which is
 * `server-only`) and the client list/form components. Kept in their own module
 * so a client component can import the type without pulling `server-only` in.
 */

/**
 * Сэтгэгдэл хэний тухай вэ: ус эсвэл бэлэн багц (0107). DB-ийн
 * `reviews_one_target` check-тэй ижил — ЯГ НЭГ.
 */
export type ReviewTarget =
  | { kind: "product"; id: string }
  | { kind: "collection"; id: string };

/** Зорилтын багана (`reviews` / `public_reviews`). */
export function targetColumn(t: ReviewTarget): "product_id" | "collection_id" {
  return t.kind === "product" ? "product_id" : "collection_id";
}

/** API-ийн талбарын нэр — `reviewInputSchema` / `reviewPageSchema`. */
export function targetParam(t: ReviewTarget): {
  productId?: string;
  collectionId?: string;
} {
  return t.kind === "product" ? { productId: t.id } : { collectionId: t.id };
}

export interface Review {
  id: string;
  /** Багцын сэтгэгдэлд null (0107). */
  productId: string | null;
  userId: string;
  rating: number;
  body: string;
  createdAt: string;
  updatedAt: string;
  authorName: string;
  authorAvatar: string | null;
}

export interface RecentReview extends Review {
  productName: string;
  productSlug: string;
  brand: string;
  productImage: string | null;
}

export interface ReviewPage {
  reviews: Review[];
  /** Every review on the product, text or rating-only — matches `rating_count`. */
  total: number;
}

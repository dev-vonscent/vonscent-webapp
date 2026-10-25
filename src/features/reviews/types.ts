import type {
  ReviewRejectReason,
  ReviewStatus,
  UserTierKey,
} from "@/lib/constants";
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
  /** Зохиогчийн түвшин — хүрээнд (feature flag `user_tiers`); хаалттай бол null. */
  authorTier?: UserTierKey | null;
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

/** `review_block_reason()` (0162) — яагаад бичиж болохгүй вэ. */
export type ReviewBlockReason =
  | "unauthorized"
  | "profile_incomplete"
  | "not_purchased"
  /** Усыг зөвхөн base багц дотор авсан — сэтгэгдэл нь багцын хуудсанд. */
  | "bought_in_bundle"
  | "already_reviewed";

/** Хэрэглэгчийн өөрийн сэтгэгдэл — ямар ч төлөвтэй. */
export interface OwnReview {
  rating: number;
  body: string;
  status: ReviewStatus;
  rejectReason: ReviewRejectReason | null;
}

/** GET /api/reviews/eligibility — хяналттай формын төлөв. */
export interface ReviewEligibility {
  reason: ReviewBlockReason | null;
  /** Батлагдвал олгох оноо (ус, багц хоёуланд); 0 бол урамшуулалгүй. */
  points: number;
  own: OwnReview | null;
}

/** Админы хяналтын жагсаалтын мөр (/admin/reviews). */
export interface AdminReview {
  id: string;
  rating: number;
  body: string;
  status: ReviewStatus;
  rejectReason: ReviewRejectReason | null;
  isVisible: boolean;
  isFeatured: boolean;
  createdAt: string;
  moderatedAt: string | null;
  authorName: string | null;
  authorPhone: string | null;
  /** «Брэнд Нэр» эсвэл багцын нэр. */
  targetName: string;
  /** `/products/<slug>` эсвэл `/collections/<slug>`; олдохгүй бол null. */
  targetHref: string | null;
}

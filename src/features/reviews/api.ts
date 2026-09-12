import "server-only";
import { createPublicClient } from "@/lib/supabase/public";
import { REVIEWS_PAGE_SIZE } from "@/lib/constants";
import type { RecentReview, Review, ReviewPage } from "./types";

export type { RecentReview, Review, ReviewPage } from "./types";

/**
 * Review data access.
 *
 * Everything here reads the `public_reviews` view (0071), which already joins
 * the reviewer's display name and the product blurb. That view runs with owner
 * rights so the anon key can resolve names without the service-role client —
 * previously this module reached for service role on a *public* page just to
 * read two columns out of `profiles`, and silently degraded every name to a
 * generic label when the key was absent.
 */

interface PublicReviewRow {
  id: string;
  product_id: string;
  user_id: string;
  rating: number;
  body: string | null;
  created_at: string;
  updated_at: string;
  author_name: string | null;
  author_avatar: string | null;
  product_name?: string | null;
  product_slug?: string | null;
  product_brand?: string | null;
  product_image?: string | null;
}

const REVIEW_COLUMNS =
  "id, product_id, user_id, rating, body, created_at, updated_at, author_name, author_avatar";

/** Shown when the reviewer never set a display name. */
const ANONYMOUS_AUTHOR = "Хэрэглэгч";

function mapReview(r: PublicReviewRow): Review {
  return {
    id: r.id,
    productId: r.product_id,
    userId: r.user_id,
    rating: r.rating,
    body: r.body ?? "",
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    authorName: r.author_name ?? ANONYMOUS_AUTHOR,
    authorAvatar: r.author_avatar ?? null,
  };
}

/**
 * One page of a product's reviews, newest first. `total` comes back from the
 * same query as the rows, so the header count can never disagree with the list.
 */
export async function getProductReviewPage(
  productId: string,
  offset = 0,
  limit: number = REVIEWS_PAGE_SIZE,
): Promise<ReviewPage> {
  const supabase = createPublicClient();
  if (!supabase) return { reviews: [], total: 0 };
  const { data, count } = await supabase
    .from("public_reviews")
    .select(REVIEW_COLUMNS, { count: "exact" })
    .eq("product_id", productId)
    .order("created_at", { ascending: false })
    // Tiebreaker: without it, two reviews sharing a timestamp can swap between
    // page requests and the "Цааш үзэх" window would skip or repeat a row.
    .order("id", { ascending: false })
    .range(offset, offset + limit - 1);
  const rows = (data as unknown as PublicReviewRow[] | null) ?? [];
  return { reviews: rows.map(mapReview), total: count ?? 0 };
}

/**
 * How many of those reviews actually carry text. A rating-only review is a
 * valid review but not a "сэтгэгдэл", and the header states both separately.
 */
export async function getProductCommentCount(
  productId: string,
): Promise<number> {
  const supabase = createPublicClient();
  if (!supabase) return 0;
  const { count } = await supabase
    .from("public_reviews")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId)
    .neq("body", "");
  return count ?? 0;
}

/** Newest reviews with text, for the home page strip. Active products only. */
export async function getRecentReviews(limit = 6): Promise<RecentReview[]> {
  const supabase = createPublicClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("public_reviews")
    .select(
      `${REVIEW_COLUMNS}, product_name, product_slug, product_brand, product_image`,
    )
    .neq("body", "")
    .eq("product_is_active", true)
    .order("created_at", { ascending: false })
    .limit(limit);
  const rows = (data as unknown as PublicReviewRow[] | null) ?? [];
  return rows.map((r) => ({
    ...mapReview(r),
    productName: r.product_name ?? "",
    productSlug: r.product_slug ?? "",
    brand: r.product_brand ?? "",
    productImage: r.product_image ?? null,
  }));
}

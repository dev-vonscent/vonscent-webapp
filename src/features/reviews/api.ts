import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * Review data access. Reviews are public content but reviewer names live in
 * `profiles` (owner/staff RLS), so reads go through the service-role client
 * when available to resolve display names; otherwise they fall back to anon.
 */

export interface Review {
  id: string;
  productId: string;
  userId: string;
  rating: number;
  body: string;
  createdAt: string;
  authorName: string;
  authorAvatar: string | null;
}

export interface RecentReview extends Review {
  productName: string;
  productSlug: string;
  brand: string;
  productImage: string | null;
}

interface ReviewJoin {
  id: string;
  product_id: string;
  user_id: string;
  rating: number;
  body: string;
  created_at: string;
  profiles: { full_name: string | null; avatar_url: string | null } | null;
  products?: {
    name: string;
    slug: string;
    brand: string;
    product_images?: { url: string; sort_order: number; is_visible?: boolean }[];
  } | null;
}

async function readClient() {
  return createAdminClient() ?? createPublicClient();
}

type DbClient = NonNullable<Awaited<ReturnType<typeof readClient>>>;
type ProfileInfo = { full_name: string | null; avatar_url: string | null };

/**
 * Reviewer names live in `profiles`, but there's no direct FK from `reviews`
 * to `profiles` (both only reference auth.users), so PostgREST can't embed it.
 * We resolve the names in a separate lookup keyed by user_id. Reads go through
 * the service-role client when available, otherwise RLS may hide other users'
 * profiles and names fall back to a generic label.
 */
async function profileMap(
  supabase: DbClient,
  userIds: string[],
): Promise<Map<string, ProfileInfo>> {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return new Map();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .in("id", ids);
  const rows =
    (data as unknown as ({ id: string } & ProfileInfo)[] | null) ?? [];
  return new Map(
    rows.map((p) => [
      p.id,
      { full_name: p.full_name, avatar_url: p.avatar_url },
    ]),
  );
}

function mapReview(r: ReviewJoin): Review {
  return {
    id: r.id,
    productId: r.product_id,
    userId: r.user_id,
    rating: r.rating,
    body: r.body,
    createdAt: r.created_at,
    authorName: r.profiles?.full_name?.trim() || "Хэрэглэгч",
    authorAvatar: r.profiles?.avatar_url ?? null,
  };
}

export async function getProductReviews(productId: string): Promise<Review[]> {
  const supabase = await readClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("reviews")
    .select("id, product_id, user_id, rating, body, created_at")
    .eq("product_id", productId)
    .order("created_at", { ascending: false });
  const rows = (data as unknown as ReviewJoin[] | null) ?? [];
  const profiles = await profileMap(
    supabase,
    rows.map((r) => r.user_id),
  );
  return rows.map((r) =>
    mapReview({ ...r, profiles: profiles.get(r.user_id) ?? null }),
  );
}

export async function getRecentReviews(limit = 6): Promise<RecentReview[]> {
  const supabase = await readClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("reviews")
    .select(
      "id, product_id, user_id, rating, body, created_at, products ( name, slug, brand, product_images ( url, sort_order, is_visible ) )",
    )
    .not("body", "eq", "")
    .order("created_at", { ascending: false })
    .limit(limit);
  const rows = (data as unknown as ReviewJoin[] | null) ?? [];
  const profiles = await profileMap(
    supabase,
    rows.map((r) => r.user_id),
  );
  return rows.map((r) => {
    const image =
      [...(r.products?.product_images ?? [])]
        .filter((i) => i.is_visible !== false)
        .sort(
        (a, b) => a.sort_order - b.sort_order,
      )[0]?.url ?? null;
    return {
      ...mapReview({ ...r, profiles: profiles.get(r.user_id) ?? null }),
      productName: r.products?.name ?? "",
      productSlug: r.products?.slug ?? "",
      brand: r.products?.brand ?? "",
      productImage: image,
    };
  });
}

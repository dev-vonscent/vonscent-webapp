import { NextResponse } from "next/server";
import {
  revalidateCollectionReviews,
  revalidateProductReviews,
} from "@/lib/cache";
import {
  reviewDeleteSchema,
  reviewInputSchema,
  reviewPageSchema,
} from "@/lib/validators/review";
import { getReviewById, getReviewPage } from "@/features/reviews/api";
import type { ReviewTarget } from "@/features/reviews/types";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffUser } from "@/lib/auth/guard";
import { enforceRateLimit } from "@/lib/rate-limit";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Validated `{ productId? , collectionId? }` → one target (schema ensures one). */
function toTarget(v: {
  productId?: string;
  collectionId?: string;
}): ReviewTarget {
  return v.collectionId
    ? { kind: "collection", id: v.collectionId }
    : { kind: "product", id: v.productId! };
}

/** Purge the page the review lives on — the rows only carry the id. */
async function revalidateTarget(
  supabase: SupabaseClient,
  target: ReviewTarget,
) {
  const table = target.kind === "product" ? "products" : "collections";
  const { data } = await supabase
    .from(table)
    .select("slug")
    .eq("id", target.id)
    .maybeSingle();
  const slug = (data as { slug?: string } | null)?.slug ?? null;
  if (target.kind === "product") revalidateProductReviews(slug);
  else revalidateCollectionReviews(slug);
}

/**
 * One page of a product's reviews — the "Цааш үзэх" button in ReviewList.
 * Public data; the first page is server-rendered, this serves the rest.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parsed = reviewPageSchema.safeParse({
    productId: searchParams.get("productId") ?? undefined,
    collectionId: searchParams.get("collectionId") ?? undefined,
    offset: searchParams.get("offset") ?? 0,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }
  const page = await getReviewPage(toTarget(parsed.data), parsed.data.offset);
  return NextResponse.json(page);
}

/**
 * Submit (or update) a review for a product or a base bundle (0107). Requires
 * an authenticated user; one review per (target, user) — upserted. The rating aggregate is kept in
 * sync by the `reviews_rating_sync` trigger (0070), not from here.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = reviewInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  if (!isSupabaseConfigured) {
    return NextResponse.json({ demo: true });
  }

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "NO_DB" }, { status: 500 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  // Хэрэглэгчийн id-ээр: сэтгэгдэл бичихэд нэвтэрсэн байх ёстой тул IP нь
  // операторын NAT ард сууж буй бусад захиалагчийг л дэмий хохироох байлаа.
  const limited = await enforceRateLimit("review", req, { subject: user.id });
  if (limited) return limited;

  const target = toTarget(input);
  // Багцын сэтгэгдэл зөвхөн нийтийн (base), идэвхтэй багцад — хэрэглэгчийн
  // хадгалсан custom багц бол хувийн зүйл, сэтгэгдлийн хуудас байхгүй.
  if (target.kind === "collection") {
    const { data: coll } = await supabase
      .from("collections")
      .select("id")
      .eq("id", target.id)
      .eq("type", "base")
      .eq("is_active", true)
      .maybeSingle();
    if (!coll)
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  // Owner-scoped RLS lets the user upsert their own review.
  const { data: saved, error } = await supabase
    .from("reviews")
    .upsert(
      {
        product_id: target.kind === "product" ? target.id : null,
        collection_id: target.kind === "collection" ? target.id : null,
        user_id: user.id,
        rating: input.rating,
        body: input.body,
      },
      {
        onConflict:
          target.kind === "product"
            ? "product_id,user_id"
            : "collection_id,user_id",
      },
    )
    .select("id")
    .single();
  if (error || !saved) {
    return NextResponse.json({ error: "INSERT_FAILED" }, { status: 500 });
  }

  await revalidateTarget(supabase, target);
  // Хадгалсан мөрийг буцаана — ISR цэвэрлэгээ router.refresh()-ээс хоцорч
  // болох тул жагсаалт үүгээр шууд шинэчлэгдэнэ.
  const review = await getReviewById((saved as { id: string }).id);
  return NextResponse.json({ ok: true, review });
}

/** Delete a review — staff only (client decision: зөвхөн админ устгана). */
export async function DELETE(req: Request) {
  const parsed = reviewDeleteSchema.safeParse({
    id: new URL(req.url).searchParams.get("id"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "MISSING_ID" }, { status: 400 });
  }

  if (!isSupabaseConfigured) return NextResponse.json({ demo: true });

  const staff = await getStaffUser();
  if (!staff) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: "NO_DB" }, { status: 500 });

  // The product comes back from the deleted row rather than a query param, so
  // the cache purge can't be skipped by a caller that forgets to send it.
  const { data, error } = await supabase
    .from("reviews")
    .delete()
    .eq("id", parsed.data.id)
    .select("product_id, collection_id")
    .maybeSingle();
  if (error)
    return NextResponse.json({ error: "DELETE_FAILED" }, { status: 500 });

  const row = data as {
    product_id: string | null;
    collection_id: string | null;
  } | null;
  if (row?.product_id) {
    await revalidateTarget(supabase, { kind: "product", id: row.product_id });
  } else if (row?.collection_id) {
    await revalidateTarget(supabase, {
      kind: "collection",
      id: row.collection_id,
    });
  }
  return NextResponse.json({ ok: true });
}

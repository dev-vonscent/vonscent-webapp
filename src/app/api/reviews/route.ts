import { NextResponse } from "next/server";
import { revalidateProductReviews } from "@/lib/cache";
import {
  reviewDeleteSchema,
  reviewInputSchema,
  reviewPageSchema,
} from "@/lib/validators/review";
import { getProductReviewPage } from "@/features/reviews/api";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffUser } from "@/lib/auth/guard";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Slug for the cache purge — the review rows only carry the product id. */
async function productSlug(
  supabase: SupabaseClient,
  productId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("products")
    .select("slug")
    .eq("id", productId)
    .maybeSingle();
  return (data as { slug?: string } | null)?.slug ?? null;
}

/**
 * One page of a product's reviews — the "Цааш үзэх" button in ReviewList.
 * Public data; the first page is server-rendered, this serves the rest.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parsed = reviewPageSchema.safeParse({
    productId: searchParams.get("productId"),
    offset: searchParams.get("offset") ?? 0,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }
  const page = await getProductReviewPage(
    parsed.data.productId,
    parsed.data.offset,
  );
  return NextResponse.json(page);
}

/**
 * Submit (or update) a review for a product. Requires an authenticated user;
 * one review per (product, user) — upserted. The rating aggregate is kept in
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

  // Owner-scoped RLS lets the user upsert their own review.
  const { error } = await supabase.from("reviews").upsert(
    {
      product_id: input.productId,
      user_id: user.id,
      rating: input.rating,
      body: input.body,
    },
    { onConflict: "product_id,user_id" },
  );
  if (error) {
    return NextResponse.json({ error: "INSERT_FAILED" }, { status: 500 });
  }

  revalidateProductReviews(await productSlug(supabase, input.productId));
  return NextResponse.json({ ok: true });
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
    .select("product_id")
    .maybeSingle();
  if (error)
    return NextResponse.json({ error: "DELETE_FAILED" }, { status: 500 });

  const productId = (data as { product_id?: string } | null)?.product_id;
  if (productId) {
    revalidateProductReviews(await productSlug(supabase, productId));
  }
  return NextResponse.json({ ok: true });
}

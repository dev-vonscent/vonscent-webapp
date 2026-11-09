import { NextResponse } from "next/server";
import {
  moderatedReviewInputSchema,
  reviewDeleteSchema,
  reviewInputSchema,
  reviewPageSchema,
} from "@/lib/validators/review";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { getReviewById, getReviewPage } from "@/features/reviews/api";
import type { ReviewTarget } from "@/features/reviews/types";
import { revalidateTarget } from "@/features/reviews/server";
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
  // Туг `review_moderation` (0162): текст заавал, 100+ тэмдэгт, нэг удаа.
  const moderated = await isFeatureEnabled("review_moderation");
  const parsed = (
    moderated ? moderatedReviewInputSchema : reviewInputSchema
  ).safeParse(body);
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
  } else {
    // Зөвхөн худалдаанд байгаа ус: «Тун удахгүй» (0125) ус хэнд ч хүрээгүй
    // тул түүний сэтгэгдэл үнэлгээг нь хуурамчаар хөөргөнө; нуусан ус
    // дэлгүүрт байхгүй.
    const { data: product } = await supabase
      .from("products")
      .select("id")
      .eq("id", target.id)
      .eq("is_active", true)
      .maybeSingle();
    if (!product)
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  if (moderated) return insertModerated(supabase, user.id, target, input);

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

/**
 * Хяналттай бичилт (0162): upsert биш insert — засах боломжгүй. Нөхцлийг
 * (бүртгэл, худалдан авалт, урт, давхардал) `reviews_moderation_guard`
 * trigger барина; энд түүний алдааг клиентийн код болгоно. Мөр `pending`
 * тул нийтэд харагдахгүй — кэш цэвэрлэх шаардлагагүй.
 */
async function insertModerated(
  supabase: SupabaseClient,
  userId: string,
  target: ReviewTarget,
  input: { rating: number; body: string },
) {
  const { error } = await supabase.from("reviews").insert({
    product_id: target.kind === "product" ? target.id : null,
    collection_id: target.kind === "collection" ? target.id : null,
    user_id: userId,
    rating: input.rating,
    body: input.body,
  });
  if (!error) return NextResponse.json({ ok: true, pending: true });

  if (error.code === "23505") {
    return NextResponse.json({ error: "already_reviewed" }, { status: 409 });
  }
  const blocked = /REVIEW_BLOCKED:(\w+)/.exec(error.message)?.[1];
  if (blocked) {
    return NextResponse.json({ error: blocked }, { status: 403 });
  }
  if (error.message.includes("REVIEW_TOO_SHORT")) {
    return NextResponse.json({ error: "too_short" }, { status: 400 });
  }
  return NextResponse.json({ error: "INSERT_FAILED" }, { status: 500 });
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

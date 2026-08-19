import { NextResponse } from "next/server";
import { revalidatePublic } from "@/lib/cache";
import { reviewInputSchema } from "@/lib/validators/review";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { callRpc } from "@/lib/supabase/rpc";

/**
 * Submit (or update) a review for a product. Requires an authenticated user;
 * one review per (product, user) — upserted. Rating aggregate is recomputed.
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
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

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

  // Recompute rating aggregate (service role; falls back to anon if missing).
  const admin = createAdminClient() ?? supabase;
  await callRpc(admin, "recompute_rating", { p_product: input.productId });

  revalidatePublic();
  return NextResponse.json({ ok: true });
}

/** Delete the current user's own review (owner RLS enforces ownership). */
export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  const productId = new URL(req.url).searchParams.get("productId");
  if (!id) return NextResponse.json({ error: "MISSING_ID" }, { status: 400 });

  if (!isSupabaseConfigured) return NextResponse.json({ demo: true });
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "NO_DB" }, { status: 500 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { error } = await supabase
    .from("reviews")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "DELETE_FAILED" }, { status: 500 });

  if (productId) {
    const admin = createAdminClient() ?? supabase;
    await callRpc(admin, "recompute_rating", { p_product: productId });
  }
  revalidatePublic();
  return NextResponse.json({ ok: true });
}

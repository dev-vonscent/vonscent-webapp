import { NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { callRpc } from "@/lib/supabase/rpc";
import type { CouponRow } from "@/db/types";
import { sortOffers, type AvailableCoupon } from "./sort";

export type { AvailableCoupon } from "./sort";

/**
 * Coupons this customer could actually use on the cart in front of them
 * (todo.md B4: "Checkout дээр купон санал болгох").
 *
 * Only coupons ISSUED TO this customer are offered (0104). Shop-wide campaign
 * coupons (`user_id` null) work by code alone — a customer who was told
 * `WELCOME11` types it in; one who wasn't never sees it. Guests get nothing:
 * coupons are for signed-in customers only.
 *
 * Every candidate is still run through `validate_coupon` for this exact
 * subtotal, so the list never suggests something that would then be refused.
 */
const schema = z.object({
  subtotal: z.number().int().nonnegative(),
});

/** How many offers the checkout shows; the rest live on /account/coupons. */
const OFFER_LIMIT = 5;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ coupons: [] }, { status: 400 });
  }
  if (!isSupabaseConfigured) return NextResponse.json({ coupons: [] });

  const session = await createClient();
  const { data: { user } = { user: null } } =
    (await session?.auth.getUser()) ?? { data: { user: null } };
  if (!user) return NextResponse.json({ coupons: [] });

  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ coupons: [] }, { status: 500 });

  // The admin client bypasses RLS, so ownership is filtered here.
  const { data } = await supabase
    .from("coupons")
    .select("*")
    .eq("is_active", true)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  const rows = (data as CouponRow[] | null) ?? [];

  const coupons: AvailableCoupon[] = [];
  for (const c of rows) {
    const { data: result } = await callRpc<{
      valid: boolean;
      discount: number;
    }>(supabase, "validate_coupon", {
      p_code: c.code,
      p_subtotal: parsed.data.subtotal,
      p_user: user.id,
    });
    if (!result?.valid || (result.discount ?? 0) <= 0) continue;
    coupons.push({
      id: c.id,
      code: c.code,
      type: c.type,
      value: c.value,
      discount: result.discount,
      minSubtotal: c.min_subtotal,
      maxDiscount: c.max_discount,
      endsAt: c.ends_at,
      personal: c.user_id != null,
    });
  }

  return NextResponse.json({
    coupons: sortOffers(coupons).slice(0, OFFER_LIMIT),
  });
}

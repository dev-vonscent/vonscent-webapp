import { NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { callRpc } from "@/lib/supabase/rpc";
import type { CouponRow } from "@/db/types";

/**
 * Coupons this customer could actually use on the cart in front of them
 * (todo.md B4: "Checkout дээр купон санал болгох").
 *
 * A customer shouldn't have to remember a code that was issued to them. Every
 * candidate is run through `validate_coupon` for this exact subtotal and
 * buyer, so the list can never suggest something that would then be refused —
 * and personal codes belonging to other people are filtered out by ownership
 * before that, not merely hidden in the UI.
 */
const schema = z.object({
  subtotal: z.number().int().nonnegative(),
});

export interface AvailableCoupon {
  code: string;
  type: "percent" | "fixed";
  value: number;
  discount: number;
  minSubtotal: number;
  endsAt: string | null;
  /** Issued to this customer alone. */
  personal: boolean;
}

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

  const supabase = createAdminClient() ?? session;
  if (!supabase) return NextResponse.json({ coupons: [] }, { status: 500 });

  // The admin client bypasses RLS, so ownership is filtered here: public
  // coupons plus the signed-in customer's own.
  let query = supabase
    .from("coupons")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(50);
  query = user
    ? query.or(`user_id.is.null,user_id.eq.${user.id}`)
    : query.is("user_id", null);

  const { data } = await query;
  const rows = (data as CouponRow[] | null) ?? [];

  const coupons: AvailableCoupon[] = [];
  for (const c of rows) {
    const { data: result } = await callRpc<{
      valid: boolean;
      discount: number;
    }>(supabase, "validate_coupon", {
      p_code: c.code,
      p_subtotal: parsed.data.subtotal,
      p_user: user?.id ?? null,
    });
    if (!result?.valid || (result.discount ?? 0) <= 0) continue;
    coupons.push({
      code: c.code,
      type: c.type,
      value: c.value,
      discount: result.discount,
      minSubtotal: c.min_subtotal,
      endsAt: c.ends_at,
      personal: c.user_id != null,
    });
  }

  // Best offer first — that is the one worth a single tap.
  coupons.sort((a, b) => b.discount - a.discount);
  return NextResponse.json({ coupons: dedupe(coupons).slice(0, 5) });
}

/**
 * Collapse coupons that are the same offer.
 *
 * Since the lucky wheel stopped replacing unused coupons (docs/lucky-wheel.md
 * §0 №1) one customer can hold six identical 5,000₮ codes. Listing them all is
 * noise — applying any one has the same effect — and worse, they crowd the
 * five-row cap so a genuinely different coupon never reaches the customer.
 *
 * The survivor is the one expiring soonest: it is the one that would otherwise
 * be wasted, and spending it leaves the longer-lived duplicates in hand.
 */
export function dedupe(coupons: AvailableCoupon[]): AvailableCoupon[] {
  const byOffer = new Map<string, AvailableCoupon>();
  for (const c of coupons) {
    const key = `${c.type}:${c.value}:${c.discount}:${c.minSubtotal}`;
    const held = byOffer.get(key);
    if (!held) {
      byOffer.set(key, c);
      continue;
    }
    // A coupon with no end date never expires, so it never wins this contest.
    const a = c.endsAt ? Date.parse(c.endsAt) : Infinity;
    const b = held.endsAt ? Date.parse(held.endsAt) : Infinity;
    if (a < b) byOffer.set(key, c);
  }
  return [...byOffer.values()];
}

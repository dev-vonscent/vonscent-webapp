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
 * subtotal, so nothing offered as usable would then be refused. A coupon that
 * fails only on its minimum order is listed too, as not yet usable with the
 * amount still to add — the condition is the thing worth telling the customer.
 */
const schema = z.object({
  subtotal: z.number().int().nonnegative(),
});

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
      reason?: string;
    }>(supabase, "validate_coupon", {
      p_code: c.code,
      p_subtotal: parsed.data.subtotal,
      p_user: user.id,
    });
    const belowMinimum = result?.reason === "MIN_SUBTOTAL";
    if (!belowMinimum && (!result?.valid || (result.discount ?? 0) <= 0)) {
      continue;
    }
    coupons.push({
      id: c.id,
      code: c.code,
      type: c.type,
      value: c.value,
      discount: belowMinimum ? 0 : result!.discount,
      minSubtotal: c.min_subtotal,
      maxDiscount: c.max_discount,
      endsAt: c.ends_at,
      personal: c.user_id != null,
      eligible: !belowMinimum,
      shortfall: belowMinimum
        ? Math.max(c.min_subtotal - parsed.data.subtotal, 0)
        : 0,
    });
  }

  // Бүгдийг буцаана. Өмнө нь дуусах огноогоор эрэмбэлээд эхний 5-ыг л
  // өгдөг байсан тул 10 купонтой хүний хамгийн их хэмнэдэг купон тасарч,
  // автомат сонголт ч түүнийг хэзээ ч олохгүй байв. Checkout-ын жагсаалт
  // dialog дотроо гүйдэг болсон; дээд хязгаар нь дээрх `.limit(50)`.
  return NextResponse.json({ coupons: sortOffers(coupons) });
}

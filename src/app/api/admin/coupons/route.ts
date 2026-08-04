import { NextResponse } from "next/server";
import { couponInputSchema } from "@/lib/validators/coupon";
import { isSupabaseConfigured } from "@/lib/env";
import { getStaffUser } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = couponInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }
  if (!isSupabaseConfigured) return NextResponse.json({ demo: true });

  const staff = await getStaffUser();
  if (!staff) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: "NO_DB" }, { status: 500 });

  const input = parsed.data;
  const { error } = await supabase.from("coupons").insert({
    code: input.code.toUpperCase(),
    type: input.type,
    value: input.value,
    min_subtotal: input.minSubtotal,
    max_uses: input.maxUses,
    max_uses_per_user: input.maxUsesPerUser,
    user_id: input.userId,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    is_active: input.isActive,
  });
  if (error) {
    return NextResponse.json({ error: "INSERT_FAILED" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

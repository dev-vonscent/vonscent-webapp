import { NextResponse } from "next/server";
import { revalidatePublic } from "@/lib/cache";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffUser } from "@/lib/auth/guard";
import {
  couponSettingsError,
  couponSettingsSchema,
} from "@/lib/validators/coupon";

const schema = z.object({
  key: z.string().min(1),
  value: z.unknown(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }

  if (!isSupabaseConfigured) {
    return NextResponse.json({ demo: true });
  }

  const staff = await getStaffUser();
  if (!staff || staff.role !== "super_admin") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  let value = parsed.data.value;
  // `grant_reward_coupon` reads this row inside the payment trigger, so a
  // malformed tier must be turned away here rather than at checkout.
  if (parsed.data.key === "coupons") {
    const coupons = couponSettingsSchema.safeParse(value);
    if (!coupons.success) {
      return NextResponse.json(
        { error: couponSettingsError(value) },
        { status: 400 },
      );
    }
    value = coupons.data;
  }

  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: "NO_DB" }, { status: 500 });

  const { error } = await supabase
    .from("settings")
    .upsert({ key: parsed.data.key, value });
  if (error) {
    return NextResponse.json({ error: "Хадгалж чадсангүй." }, { status: 500 });
  }

  revalidatePublic();
  return NextResponse.json({ ok: true });
}

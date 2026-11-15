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
import {
  DELIVERY_BLACKOUT_KEY,
  deliveryBlackoutSchema,
  normalizeBlackout,
} from "@/lib/delivery-blackout";
import { ubToday } from "@/lib/time";

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
  // Checkout болон захиалгын route энэ мөрийг уншина — буруу өдөр энд л
  // буцаагдана. Өнгөрсөн өдрүүд хадгалахдаа автоматаар цэвэрлэгдэнэ.
  if (parsed.data.key === DELIVERY_BLACKOUT_KEY) {
    const blackout = deliveryBlackoutSchema.safeParse(value);
    if (!blackout.success) {
      return NextResponse.json(
        { error: "Хүргэлтгүй өдрийн жагсаалт буруу байна." },
        { status: 400 },
      );
    }
    const today = ubToday();
    value = {
      days: normalizeBlackout(blackout.data).filter((d) => d > today),
    };
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

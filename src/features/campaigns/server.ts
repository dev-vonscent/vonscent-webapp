import "server-only";
import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getStaffUser } from "@/lib/auth/guard";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CampaignInput } from "@/lib/validators/campaign";
import { overlapMessage } from "./lib";

/**
 * Админы кампанит ажлын route бүрийн хаалга: туг (404) → staff (403) →
 * service-role client. Туг хаалттай үед route байхгүй мэт — нээгдээгүй
 * feature-ийн нэр ч, алдааны хэлбэр ч ил гарахгүй.
 */
export async function campaignAdminGate() {
  if (!(await isFeatureEnabled("campaigns"))) {
    return {
      response: NextResponse.json({ error: "NOT_FOUND" }, { status: 404 }),
    } as const;
  }
  if (!isSupabaseConfigured) {
    return { response: NextResponse.json({ demo: true }) } as const;
  }
  const staff = await getStaffUser();
  if (!staff) {
    return {
      response: NextResponse.json(
        { error: "Эрх баталгаажсангүй. Хуудсаа сэргээгээд дахин нэвтэрнэ үү." },
        { status: 403 },
      ),
    } as const;
  }
  const supabase = createAdminClient();
  if (!supabase) {
    return {
      response: NextResponse.json({ error: "NO_DB" }, { status: 500 }),
    } as const;
  }
  return { supabase, staff } as const;
}

/** Маягтын утга → `campaigns` мөр. */
export function toCampaignColumns(input: CampaignInput) {
  return {
    type: input.type,
    name: input.name,
    description: input.description,
    is_active: input.isActive,
    starts_on: input.startsOn,
    ends_on: input.endsOn,
    coupon_value: input.couponValue,
    min_subtotal: input.minSubtotal,
    coupon_valid_days: input.couponValidDays,
  };
}

/** Сангийн алдаа → админд харагдах хариу. Давхцал нь 409 + ойлгомжтой текст. */
export function campaignWriteError(message: string) {
  const overlap = overlapMessage(message);
  if (overlap) return NextResponse.json({ error: overlap }, { status: 409 });
  return NextResponse.json(
    { error: "Хадгалах үед алдаа гарлаа. Дахин оролдоно уу." },
    { status: 500 },
  );
}

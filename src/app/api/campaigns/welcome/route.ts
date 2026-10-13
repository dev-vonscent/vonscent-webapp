import { NextResponse } from "next/server";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { WelcomeGift } from "@/features/campaigns/types";

/**
 * Шинэ хэрэглэгчийн мэндчилгээ (0135): бүртгүүлэхэд авсан купоныг нэг удаа
 * харуулна.
 *
 *   GET  → харуулаагүй бэлэг (`{ gift: WelcomeGift | null }`)
 *   POST → харуулсан гэж тэмдэглэнэ (`notified_at`)
 *
 * `campaign_grants` нь staff-only RLS-тэй тул session-ээс хэрэглэгчийг
 * тогтоогоод service-role-оор зөвхөн ӨӨРИЙНХ нь мөрийг уншина.
 */
async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

const notFound = () =>
  NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

export async function GET() {
  if (!(await isFeatureEnabled("campaigns"))) return notFound();
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ gift: null });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ gift: null });

  const { data: grant } = await admin
    .from("campaign_grants")
    .select("campaign_id")
    .eq("user_id", userId)
    .is("notified_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!grant) return NextResponse.json({ gift: null });
  const campaignId = (grant as { campaign_id: string }).campaign_id;

  const { data: coupons } = await admin
    .from("coupons")
    .select("code, value, min_subtotal, ends_at")
    .eq("campaign_id", campaignId)
    .eq("user_id", userId)
    .order("created_at")
    .limit(1);
  const row = (
    coupons as
      | {
          code: string;
          value: number;
          min_subtotal: number;
          ends_at: string | null;
        }[]
      | null
  )?.[0];
  if (!row) return NextResponse.json({ gift: null });

  const gift: WelcomeGift = {
    value: row.value,
    code: row.code,
    minSubtotal: row.min_subtotal,
    endsAt: row.ends_at,
  };
  return NextResponse.json({ gift });
}

export async function POST() {
  if (!(await isFeatureEnabled("campaigns"))) return notFound();
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "NO_DB" }, { status: 500 });

  const { error } = await admin
    .from("campaign_grants")
    .update({ notified_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("notified_at", null);
  if (error) return NextResponse.json({ error: "FAILED" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { revalidatePublic } from "@/lib/cache";
import { isSupabaseConfigured } from "@/lib/env";
import { getStaffUser } from "@/lib/auth/guard";
import { revalidateFeatureFlags } from "@/lib/feature-flags";
import { createAdminClient } from "@/lib/supabase/admin";
import { featureFlagUpdateSchema } from "@/lib/validators/feature-flag";

/**
 * Feature flag асаах/унтраах (admin → Feature flag, 0133).
 *
 * Зөвхөн super_admin: prod дээр нэг даралт бүх хэрэглэгчид feature нээдэг.
 * `upsert` — feature-ийн migration мөрөө нэмээгүй байсан ч кодонд
 * бүртгэлтэй туг бол энд үүснэ.
 */
export async function PATCH(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = featureFlagUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }
  if (!isSupabaseConfigured) return NextResponse.json({ demo: true });

  // Middleware-ээс гадна route handler дотор давхар шалгалт (development.md §7.5).
  const staff = await getStaffUser();
  if (!staff || staff.role !== "super_admin") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: "NO_DB" }, { status: 500 });

  const { key, enabled } = parsed.data;
  const { error } = await supabase
    .from("feature_flags")
    .upsert({ key, enabled, updated_by: staff.id });

  if (error) {
    // 42P01 = feature_flags хүснэгт байхгүй — 0133 ажиллаагүй байна.
    if ((error as { code?: string }).code === "42P01") {
      return NextResponse.json({ error: "NOT_MIGRATED" }, { status: 503 });
    }
    return NextResponse.json({ error: "Хадгалж чадсангүй." }, { status: 500 });
  }

  // Тугийг уншсан ISR хуудсууд (цэс, хуудас 404) шинэ утгаар дахин үүснэ.
  revalidateFeatureFlags();
  revalidatePublic();
  return NextResponse.json({ ok: true });
}

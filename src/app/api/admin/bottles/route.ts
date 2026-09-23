import { NextResponse } from "next/server";
import { revalidatePublic } from "@/lib/cache";
import { bottleStockUpdateSchema } from "@/lib/validators/bottle-stock";
import { isSupabaseConfigured } from "@/lib/env";
import { getStaffUser } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Савны нөөц (admin → Агуулах → Савны нөөц).
 *
 * Нэг өнгө (хүйс) × хэмжээний ХООСОН сав дуусахад админ энэ замаар хаана —
 * тэр хослолтой бүх бараа тэр хэмжээгээрээ шууд зарагдахаа болино
 * (`bottle_active()`, 0095). Бараа тус бүрийн `is_active`-ийг ХӨНДӨХГҮЙ:
 * гараар унтраасан хэмжээ сав ирсэн ч унтарсан хэвээр байх ёстой.
 */
export async function PATCH(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = bottleStockUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  if (!isSupabaseConfigured) return NextResponse.json({ demo: true });

  // Middleware-ээс гадна route handler дотор давхар шалгалт (development.md §7.5).
  const staff = await getStaffUser();
  if (!staff) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: "NO_DB" }, { status: 500 });

  const { gender, ml, isActive, note, clearOverrides } = parsed.data;

  const { error } = await supabase
    .from("bottle_stock")
    .update({
      is_active: isActive,
      ...(note === undefined ? {} : { note }),
      updated_by: staff.id,
    })
    .eq("gender", gender)
    .eq("ml", ml);

  if (error) {
    // 42P01 = bottle_stock хүснэгт байхгүй — 0095 ажиллаагүй байна.
    if ((error as { code?: string }).code === "42P01") {
      return NextResponse.json({ error: "NOT_MIGRATED" }, { status: 503 });
    }
    return NextResponse.json({ error: "UPDATE_FAILED" }, { status: 500 });
  }

  // Түгжээг НЭЭХ үед л утгатай: хаалттай байхад өгсөн онцгой зөвшөөрлийг
  // үлдээвэл дараагийн түгжээнд чимээгүй нэвчинэ.
  let clearedOverrides = 0;
  if (isActive && clearOverrides) {
    const { data: ids } = await supabase
      .from("products")
      .select("id")
      .eq("gender", gender);
    const productIds = (ids as { id: string }[] | null)?.map((r) => r.id) ?? [];
    if (productIds.length) {
      const { data: cleared } = await supabase
        .from("product_variants")
        .update({ bottle_override: false })
        .eq("ml", ml)
        .eq("bottle_override", true)
        .in("product_id", productIds)
        .select("id");
      clearedOverrides = (cleared as { id: string }[] | null)?.length ?? 0;
    }
  }

  revalidatePublic();
  return NextResponse.json({ ok: true, clearedOverrides });
}

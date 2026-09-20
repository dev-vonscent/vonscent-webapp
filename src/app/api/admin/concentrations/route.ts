import { NextResponse } from "next/server";
import { revalidatePublic } from "@/lib/cache";
import { concentrationCreateSchema } from "@/lib/validators/concentration";
import { isSupabaseConfigured } from "@/lib/env";
import { getStaffUser } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  CONCENTRATION_COLUMNS,
  toConcentrationOption,
  type ConcentrationRowJson,
} from "./row";

/**
 * Үнэртний төрөл бүртгэх (0085) — барааны формын «Төрөл» талбараас шууд.
 *
 * Шинээр авсан ус нь Eau Fraîche, attar, тос ч байж болох тул төрлийн
 * жагсаалт migration-д хаагдаагүй. Брэндийн адилаар шинэ мөрөө буцаана:
 * формыг орхилгүй нэмээд шууд сонгох ёстой.
 */

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = concentrationCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  if (!isSupabaseConfigured) return NextResponse.json({ demo: true });

  const staff = await getStaffUser();
  if (!staff) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: "NO_DB" }, { status: 500 });

  const { data, error } = await supabase
    .from("concentrations")
    .insert({
      code: parsed.data.code,
      label: parsed.data.label,
      // Seed rows sit at 10…110; anything coined later lands after them
      // rather than in the middle of the standard ladder.
      sort_order: 200,
      is_active: true,
    })
    .select(CONCENTRATION_COLUMNS)
    .single();

  if (error) {
    const code = (error as { code?: string }).code;
    if (code === "23505")
      return NextResponse.json({ error: "DUPLICATE" }, { status: 409 });
    // 42P01 = хүснэгт алга — 0085 ажиллаагүй байна.
    if (code === "42P01")
      return NextResponse.json({ error: "NOT_MIGRATED" }, { status: 503 });
    return NextResponse.json({ error: "INSERT_FAILED" }, { status: 500 });
  }

  revalidatePublic();
  return NextResponse.json({
    ok: true,
    concentration: toConcentrationOption(
      data as unknown as ConcentrationRowJson,
    ),
  });
}

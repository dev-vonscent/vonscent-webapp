import { NextResponse } from "next/server";
import { noteTranslationsSaveSchema } from "@/lib/validators/note-translation";
import { isSupabaseConfigured } from "@/lib/env";
import { getStaffUser } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Нотын англи нэрийг хадгална (0102). Нэг нот дахин ирвэл дарж бичнэ.
 *
 * Дэлгүүрт харагдахгүй (зөвхөн зураг үүсгэхэд) тул нийтийн cache цэвэрлэх
 * шаардлагагүй.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = noteTranslationsSaveSchema.safeParse(body);
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

  const now = new Date().toISOString();
  const { error } = await supabase.from("note_translations").upsert(
    parsed.data.items.map((i) => ({
      mn: i.mn,
      en: i.isAbstract ? "" : i.en,
      is_abstract: i.isAbstract,
      updated_at: now,
      updated_by: staff.id,
    })),
    { onConflict: "mn" },
  );
  if (error) {
    // 42P01 = хүснэгт алга — 0102 ажиллаагүй байна.
    if ((error as { code?: string }).code === "42P01")
      return NextResponse.json({ error: "NOT_MIGRATED" }, { status: 503 });
    return NextResponse.json({ error: "SAVE_FAILED" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { noteLookupSchema } from "@/lib/validators/note-translation";
import { isSupabaseConfigured } from "@/lib/env";
import { getStaffUser } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadNoteOverrides } from "@/lib/ai/note-overrides";
import { describeNotes } from "@/lib/ai/notes-en";

/**
 * «Нот шалгах» — нот бүрийн зурагт орох англи нэр (кодын хүснэгт эсвэл
 * `note_translations`). Бараа хадгалахаас өмнө админ орчуулгаа шалгаж,
 * дутууг нь бөглөнө — хадгалах үед AI зураг шууд үүсдэг тул.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = noteLookupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const staff = isSupabaseConfigured ? await getStaffUser() : null;
  if (isSupabaseConfigured && !staff)
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  // `note_translations` RLS-ээр хаалттай тул service role-оор уншина. Сангүй
  // (demo) үед кодын хүснэгт дангаараа ажиллана.
  const supabase = isSupabaseConfigured ? createAdminClient() : null;
  const overrides = supabase ? await loadNoteOverrides(supabase) : undefined;
  return NextResponse.json({
    notes: describeNotes(parsed.data.notes, overrides),
  });
}

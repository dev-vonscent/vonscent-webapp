import { NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { getStaffUser } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({ note: z.string().trim().max(2000) });

/**
 * Захиалгын админы дотоод тэмдэглэл (0145) — зөвхөн ажилтан. Хэрэглэгчид
 * хэзээ ч харагдахгүй. Хоосон тэмдэглэл = устгана.
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }
  if (!isSupabaseConfigured) return NextResponse.json({ demo: true });

  const staff = await getStaffUser();
  if (!staff) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: "NO_DB" }, { status: 500 });

  const { note } = parsed.data;
  const { error } = note
    ? await supabase.from("order_admin_notes").upsert(
        {
          order_id: id,
          note,
          updated_at: new Date().toISOString(),
          updated_by: staff.id,
        },
        { onConflict: "order_id" },
      )
    : await supabase.from("order_admin_notes").delete().eq("order_id", id);
  if (error) {
    // 23503 = захиалга алга.
    if ((error as { code?: string }).code === "23503")
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ error: "SAVE_FAILED" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

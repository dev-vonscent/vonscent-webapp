import { NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/** Хадгалсан захиалгыг устгах — «Устгах», эсвэл «Захиалах» дарж сагсанд буцаасны дараа. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }
  if (!isSupabaseConfigured) return NextResponse.json({ ok: true });

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "NO_DB" }, { status: 500 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  // RLS ч барина; `user_id` шүүлт нь давхар хамгаалалт (staff-д нээлттэй
  // policy нэмэгдсэн ч өөр хүнийхийг устгахгүй).
  const { error } = await supabase
    .from("saved_checkouts")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "DB" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getStaffUser } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";

/** Mark one admin notification read. */
export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isSupabaseConfigured) return NextResponse.json({ demo: true });

  const staff = await getStaffUser();
  if (!staff) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "NO_DB" }, { status: 500 });
  }

  const { error } = await supabase
    .from("admin_notifications")
    .update({ is_read: true })
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: "UPDATE_FAILED" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

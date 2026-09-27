import { NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { getStaffUser } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { PREPARABLE_ORDER_STATUSES } from "@/lib/constants";

const schema = z.object({ prepared: z.boolean() });

/**
 * Mark an order as prepared (weighed and bagged) or undo it — staff only.
 *
 * Only a live order that is still ours to hand over can change: pending has
 * not been paid yet, and delivered/cancelled are closed. The status filter
 * sits in the UPDATE itself so a concurrent cancel cannot slip between a
 * read and the write.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }

  if (!isSupabaseConfigured) return NextResponse.json({ demo: true });

  const staff = await getStaffUser();
  if (!staff) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: "NO_DB" }, { status: 500 });

  const { prepared } = parsed.data;
  const { data, error } = await supabase
    .from("orders")
    .update({
      prepared_at: prepared ? new Date().toISOString() : null,
      prepared_by: prepared ? staff.id : null,
    })
    .eq("id", id)
    .in("status", [...PREPARABLE_ORDER_STATUSES])
    .select("id");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "ILLEGAL_STATUS" }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}

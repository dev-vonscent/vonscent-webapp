import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { callRpc } from "@/lib/supabase/rpc";
import { isOrderEditable } from "@/lib/time";
import type { OrderRow } from "@/db/types";

/**
 * Customer-initiated cancellation. Allowed only while the order is still
 * `pending` or `confirmed`; releases the reserved inventory via cancel_order.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!isSupabaseConfigured) {
    return NextResponse.json({ demo: true });
  }
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "NO_DB" }, { status: 500 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  // RLS lets the owner read their own order; confirm ownership + status.
  const { data } = await supabase
    .from("orders")
    .select("id, user_id, status, created_at")
    .eq("id", id)
    .maybeSingle();
  const order = data as Pick<
    OrderRow,
    "id" | "user_id" | "status" | "created_at"
  > | null;
  if (!order || order.user_id !== user.id) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  if (order.status !== "pending" && order.status !== "confirmed") {
    return NextResponse.json({ error: "NOT_CANCELLABLE" }, { status: 409 });
  }
  // Past 10:00 on the dispatch day the decants are already being prepared
  // (requirement_fb.md §9). Enforced server-side, not just in the UI.
  if (!isOrderEditable(order.created_at)) {
    return NextResponse.json({ error: "PAST_CUTOFF" }, { status: 409 });
  }

  const admin = createAdminClient() ?? supabase;
  await callRpc(admin, "update_order_status", {
    p_order: id,
    p_status: "cancelled",
    p_note: "Хэрэглэгч цуцалсан",
    p_by: user.id,
  });

  return NextResponse.json({ ok: true });
}

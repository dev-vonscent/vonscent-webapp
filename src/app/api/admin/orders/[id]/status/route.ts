import { NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { getStaffUser } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { callRpc } from "@/lib/supabase/rpc";
import { sendOrderCustomerEmail } from "@/lib/notify/customer-email";

const schema = z.object({
  status: z
    .enum(["pending", "confirmed", "shipping", "delivered", "cancelled"])
    .optional(),
  note: z.string().max(300).optional(),
  paid: z.boolean().optional(),
  refund: z.boolean().optional(),
});

/** Update order status / issue refund (staff only). */
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

  if (parsed.data.paid) {
    // Commit inventory + earn loyalty (idempotent).
    await callRpc(supabase, "mark_order_paid", { p_order: id });
    // e.g. a bank transfer the admin just verified — same notice as QPay.
    await sendOrderCustomerEmail(id, "paid");
  }
  if (parsed.data.status) {
    await callRpc(supabase, "update_order_status", {
      p_order: id,
      p_status: parsed.data.status,
      p_note: parsed.data.note ?? "",
      p_by: staff.id,
    });
    if (parsed.data.status === "cancelled") {
      await sendOrderCustomerEmail(id, "cancelled");
    }
  }
  if (parsed.data.refund) {
    await callRpc(supabase, "mark_order_refunded", {
      p_order: id,
      p_by: staff.id,
    });
  }

  return NextResponse.json({ ok: true });
}

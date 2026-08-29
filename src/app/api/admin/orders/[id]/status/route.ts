import { NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { getStaffUser } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { callRpc } from "@/lib/supabase/rpc";
import { sendOrderCustomerEmail } from "@/lib/notify/customer-email";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/constants";

const schema = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  note: z.string().max(300).optional(),
  paid: z.boolean().optional(),
  refund: z.boolean().optional(),
});

/**
 * Legal next statuses, repeated here on purpose. The Select in
 * `order-status-control.tsx` filters the same way, but a client-side filter is
 * a convenience, not a rule (development.md §7.5: repeat the check in every
 * route handler). Recovery out of a terminal status is super_admin only.
 */
const NEXT_STATUSES: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["shipping", "cancelled"],
  shipping: ["delivered", "confirmed", "cancelled"],
  delivered: [],
  cancelled: [],
};

const RECOVERY_STATUSES: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: [],
  confirmed: [],
  shipping: [],
  delivered: ["shipping"],
  cancelled: ["pending"],
};

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
    const { error } = await callRpc(supabase, "mark_order_paid", {
      p_order: id,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    // e.g. a bank transfer the admin just verified — same notice as QPay.
    await sendOrderCustomerEmail(id, "paid");
  }

  if (parsed.data.status) {
    const { data: row } = await supabase
      .from("orders")
      .select("status")
      .eq("id", id)
      .maybeSingle();
    const current = (row as { status?: OrderStatus } | null)?.status;
    if (!current) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    const next = parsed.data.status;
    const allowed =
      next === current ||
      NEXT_STATUSES[current].includes(next) ||
      (staff.role === "super_admin" &&
        RECOVERY_STATUSES[current].includes(next));
    if (!allowed) {
      return NextResponse.json(
        { error: "ILLEGAL_TRANSITION" },
        { status: 409 },
      );
    }

    const { error } = await callRpc(supabase, "update_order_status", {
      p_order: id,
      p_status: next,
      p_note: parsed.data.note ?? "",
      p_by: staff.id,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (next === "cancelled") {
      await sendOrderCustomerEmail(id, "cancelled");
    }
  }

  if (parsed.data.refund) {
    const { error } = await callRpc(supabase, "mark_order_refunded", {
      p_order: id,
      p_by: staff.id,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}

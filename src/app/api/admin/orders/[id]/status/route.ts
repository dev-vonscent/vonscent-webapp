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
    // A cancelled order has already given its ml, points and coupon back —
    // marking it paid would resurrect it as `confirmed` and commit that ml a
    // second time. `mark_order_paid` refuses too; this is the handler-side
    // repeat (development.md §7.5).
    const { data: row } = await supabase
      .from("orders")
      .select("status")
      .eq("id", id)
      .maybeSingle();
    if ((row as { status?: OrderStatus } | null)?.status === "cancelled") {
      return NextResponse.json({ error: "ORDER_CANCELLED" }, { status: 409 });
    }
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
      .select("status, payment_status")
      .eq("id", id)
      .maybeSingle();
    const order = row as {
      status?: OrderStatus;
      payment_status?: string;
    } | null;
    const current = order?.status;
    if (!current) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    // A refunded order is closed: reopening it would put a live order back in
    // the queue with the money already returned.
    if (order?.payment_status === "refunded") {
      return NextResponse.json({ error: "ORDER_REFUNDED" }, { status: 409 });
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
    // Refund is the receipt for money the admin has already sent back, and it
    // only makes sense once the order itself is void: cancelling is what
    // returns the ml, the V points and the coupon (0019/0040). Refunding a
    // live order would leave «Хүргэгдэж буй + Буцаагдсан» with none of that
    // undone. `mark_order_refunded` enforces the same rule under a row lock.
    const { data, error } = await callRpc<{ ok: boolean; reason?: string }>(
      supabase,
      "mark_order_refunded",
      { p_order: id, p_by: staff.id },
    );
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data?.ok) {
      return NextResponse.json(
        { error: data?.reason ?? "ILLEGAL_REFUND" },
        { status: 409 },
      );
    }
  }

  return NextResponse.json({ ok: true });
}

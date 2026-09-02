import { NextResponse } from "next/server";
import { revalidatePublic } from "@/lib/cache";
import { env, isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { callRpc } from "@/lib/supabase/rpc";
import { isOrderEditable } from "@/lib/time";
import { sendEmail, STORE_INBOX, renderEmail } from "@/lib/email";
import { formatPrice } from "@/lib/format";
import { sendOrderCustomerEmail } from "@/lib/notify/customer-email";
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
  if (!user)
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

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
  // Past 09:00 on the dispatch day the decants are already being prepared
  // (requirement_fb.md §9). Enforced server-side, not just in the UI.
  if (!isOrderEditable(order.created_at)) {
    return NextResponse.json({ error: "PAST_CUTOFF" }, { status: 409 });
  }

  const admin = createAdminClient() ?? supabase;
  const { error: cancelError } = await callRpc(admin, "update_order_status", {
    p_order: id,
    p_status: "cancelled",
    p_note: "Хэрэглэгч цуцалсан",
    p_by: user.id,
  });
  // A failed cancellation must not report success (or email the admin).
  if (cancelError) {
    return NextResponse.json({ error: "CANCEL_FAILED" }, { status: 500 });
  }

  // The DB trigger (0032) already dropped an admin_notifications row; the
  // email is a best-effort extra channel so the admin hears about it fast
  // enough to arrange the refund.
  const { data: full } = await admin
    .from("orders")
    .select("order_no, contact_name, contact_phone, total, payment_status")
    .eq("id", id)
    .maybeSingle();
  const o = full as {
    order_no: string;
    contact_name: string | null;
    contact_phone: string | null;
    total: number;
    payment_status: string;
  } | null;
  if (o) {
    const { html, text } = renderEmail({
      preheader: `${o.order_no} — цуцлагдсан захиалга`,
      heading: `Захиалга цуцлагдлаа — ${o.order_no}`,
      paragraphs: ["Хэрэглэгч захиалгаа өөрөө цуцаллаа."],
      lines: [
        { label: "Хэрэглэгч", value: o.contact_name ?? "—" },
        { label: "Утас", value: o.contact_phone ?? "—" },
        { label: "Дүн", value: formatPrice(o.total), strong: true },
      ],
      note:
        o.payment_status === "paid"
          ? "Төлбөр төлөгдсөн байсан — хэрэглэгчтэй холбогдож мөнгийг нь буцаана уу."
          : "Төлбөр төлөгдөөгүй байсан.",
      cta: {
        label: "Захиалгыг нээх",
        href: `${env.siteUrl}/admin/orders/${id}`,
      },
    });
    await sendEmail({
      to: STORE_INBOX,
      subject: `Захиалга цуцлагдлаа: ${o.order_no}`,
      text,
      html,
    });
  }
  // The customer gets their own copy on the email they registered (if any).
  await sendOrderCustomerEmail(id, "cancelled");

  revalidatePublic();
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { revalidatePublic } from "@/lib/cache";
import { env, isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { callRpc } from "@/lib/supabase/rpc";
import { cancelOrderInvoice } from "@/lib/payments/cancel-invoice";
import { isOrderEditable } from "@/lib/time";
import { sendEmail, STORE_INBOX, renderEmail } from "@/lib/email";
import { formatPrice } from "@/lib/format";
import { sendOrderCustomerEmail } from "@/lib/notify/customer-email";
import { cancelOrderSchema } from "@/lib/validators/refund";
import { maskAccount, refundBreakdown } from "@/lib/refund";
import type { OrderRow } from "@/db/types";

/**
 * Customer-initiated cancellation. Allowed only while the order is still
 * `pending` or `confirmed`; releases the reserved inventory via cancel_order.
 *
 * Төлсөн захиалгад буцаалтын данс ЗААВАЛ (`refundAccount`, клиент
 * 2026-09-30): QPay зөвхөн картын гүйлгээг буцаадаг тул админ гараар
 * шилжүүлнэ. Данс нь цуцлахаас ӨМНӨ хадгалагдана — хадгалж чадаагүй бол
 * захиалга цуцлагдахгүй, эс бөгөөс мөнгө нь хаашаа ч буцахгүй цуцлалт үлдэнэ.
 */
export async function POST(
  req: Request,
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
  // Хоосон бие (төлөөгүй захиалга, хуучин клиент) = данс байхгүй.
  const raw = await req.text();
  const parsed = cancelOrderSchema.safeParse(raw ? safeJson(raw) : {});
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }

  const { data } = await supabase
    .from("orders")
    .select("id, user_id, status, payment_status, created_at, deliver_on")
    .eq("id", id)
    .maybeSingle();
  const order = data as Pick<
    OrderRow,
    "id" | "user_id" | "status" | "payment_status" | "created_at" | "deliver_on"
  > | null;
  if (!order || order.user_id !== user.id) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  if (order.status !== "pending" && order.status !== "confirmed") {
    return NextResponse.json({ error: "NOT_CANCELLABLE" }, { status: 409 });
  }
  // Once the delivery day has begun (00:00 UB) the decants are being prepared
  // for it. A pre-order therefore stays cancellable right up to the midnight
  // before the day it was booked for. Enforced server-side, not just in the UI.
  if (!isOrderEditable(order)) {
    return NextResponse.json({ error: "PAST_CUTOFF" }, { status: 409 });
  }

  // Сесийн клиент рүү унахгүй. `update_order_status` нь мл, оноо, купоныг
  // буцаадаг тул 0088-аас хойш `anon`/`authenticated`-д хаалттай — fallback
  // нь ажиллахаа больсон бөгөөд чимээгүй амжилтгүй болохоос ил алдаа дээр.
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "NO_DB" }, { status: 500 });
  }
  const refundAccount = parsed.data.refundAccount;
  if (order.payment_status === "paid") {
    if (!refundAccount) {
      return NextResponse.json(
        { error: "REFUND_ACCOUNT_REQUIRED" },
        { status: 400 },
      );
    }
    const { error: accountError } = await admin
      .from("order_refund_accounts")
      .upsert({
        order_id: id,
        bank: refundAccount.bank,
        account_number: refundAccount.accountNumber,
        holder_name: refundAccount.holderName,
      });
    if (accountError) {
      return NextResponse.json(
        { error: "REFUND_ACCOUNT_FAILED" },
        { status: 500 },
      );
    }
  }

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

  // QPay-ийн invoice-ыг ч хаана — эс тэгвээс утсан дээр нээлттэй үлдсэн QR
  // цуцлагдсан захиалгад төлбөр оруулж, гараар буцаах ажил үүсгэнэ.
  await cancelOrderInvoice(id);

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
    const refund =
      o.payment_status === "paid" ? refundBreakdown(o.total) : null;
    const { html, text } = renderEmail({
      preheader: `${o.order_no} — цуцлагдсан захиалга`,
      heading: `Захиалга цуцлагдлаа — ${o.order_no}`,
      paragraphs: ["Хэрэглэгч захиалгаа өөрөө цуцаллаа."],
      lines: [
        { label: "Хэрэглэгч", value: o.contact_name ?? "—" },
        { label: "Утас", value: o.contact_phone ?? "—" },
        { label: "Дүн", value: formatPrice(o.total), strong: !refund },
        ...(refund && refundAccount
          ? [
              {
                label: "Буцаах дүн",
                value: `${formatPrice(refund.amount)} (шимтгэл ${formatPrice(refund.fee)})`,
                strong: true,
              },
              {
                label: "Данс",
                // Бүтэн дугаар имэйлээр явахгүй — админы хуудсанд л.
                value: `${refundAccount.bank} · ${maskAccount(refundAccount.accountNumber)} · ${refundAccount.holderName}`,
              },
            ]
          : []),
      ],
      note: refund
        ? "Төлбөр төлөгдсөн байсан — захиалгын хуудаснаас дансыг харж мөнгийг нь буцаагаад «Буцаалт хийх» гэж тэмдэглэнэ үү."
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

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

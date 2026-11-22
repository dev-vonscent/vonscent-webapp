import { NextResponse } from "next/server";
import {
  giftCardPurchaseSchema,
  giftCardSendAt,
} from "@/lib/validators/gift-card";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { callRpc } from "@/lib/supabase/rpc";
import { enforceRateLimit } from "@/lib/rate-limit";
import { ensureInvoice } from "@/lib/payments/invoice";
import { isQpayMockMode } from "@/lib/payments/qpay";
import { RESERVE_TIMEOUT_MINUTES } from "@/lib/constants";
import { captureOrderContext } from "@/lib/meta/capi";
import {
  claimOrderRequest,
  completeOrderRequest,
  releaseOrderRequest,
} from "@/lib/orders/idempotency";
import { isPhoneEmail } from "@/lib/auth/phone-email";
import { ORDER_MESSAGES, knownErrorCode } from "@/features/gift-cards/messages";

/**
 * POST /api/gift-cards/orders — бэлгийн карт худалдан авах (gift-cards-plan
 * §4.1). Сагсгүй, шууд: нэг карт = нэг захиалга, купон/оноо байхгүй
 * (`place_gift_card_order` өөрөө ч хүлээж авдаггүй). Хариу нь `/pay/<token>`.
 *
 * Эрх: туг (route + RPC), нэвтрэлт заавал (§12-Q1), IP-ийн rate limit,
 * идемпотентын түлхүүр (давхар дарахад нэг л захиалга).
 */
export async function POST(req: Request) {
  if (!(await isFeatureEnabled("gift_cards"))) {
    return NextResponse.json({ error: "FEATURE_DISABLED" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = giftCardPurchaseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  const sessionClient = await createClient();
  const {
    data: { user },
  } = sessionClient
    ? await sessionClient.auth.getUser()
    : { data: { user: null } };
  if (!user) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  }

  const limited = await enforceRateLimit("order", req);
  if (limited) return limited;

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "ORDER_FAILED" }, { status: 503 });
  }

  if (input.requestId) {
    const claim = await claimOrderRequest(supabase, input.requestId);
    if (!claim.won) {
      if (!claim.existingOrderId) {
        return NextResponse.json({ error: "ORDER_PENDING" }, { status: 409 });
      }
      // Өөр хэрэглэгч / энгийн захиалгын түлхүүр таарсан ч бусдын
      // pay_token буцаахгүй.
      const { data } = await supabase
        .from("orders")
        .select("pay_token")
        .eq("id", claim.existingOrderId)
        .eq("user_id", user.id)
        .eq("order_type", "gift_card")
        .maybeSingle();
      return NextResponse.json({
        payToken: (data as { pay_token: string } | null)?.pay_token ?? null,
        qpayMock: isQpayMockMode(),
        deduplicated: true,
      });
    }
  }

  // Захиалгын холбоо барих мэдээлэл нь худалдан авагчийнх (хүргэлтгүй).
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("full_name, phone")
    .eq("id", user.id)
    .maybeSingle();
  const profile = profileRow as {
    full_name: string | null;
    phone: string | null;
  } | null;

  const { data, error } = await callRpc<{ order_id: string; order_no: string; total: number }>(
    supabase,
    "place_gift_card_order",
    {
      p_user: user.id,
      p_card: {
        amount: input.amount,
        design_id: input.designId,
        recipient_name: input.recipientName,
        message: input.message,
        from_name: input.fromName,
        recipient_email:
          input.delivery === "self" ? null : input.recipientEmail,
        send_at:
          input.delivery === "scheduled" ? giftCardSendAt(input.sendDay) : null,
        contact_name: profile?.full_name || input.fromName,
        contact_phone: profile?.phone ?? "",
        contact_email:
          user.email && !isPhoneEmail(user.email) ? user.email : null,
        reserve_minutes: RESERVE_TIMEOUT_MINUTES,
        // «Дараа захиалах» (0179 §8b): төлөгдөөгүй цуцлагдвал маягт
        // сэргээгдэнэ. requestId-гүй — дахин илгээхэд шинэ захиалга.
        draft: {
          amount: input.amount,
          designId: input.designId,
          recipientName: input.recipientName,
          message: input.message ?? "",
          fromName: input.fromName,
          delivery: input.delivery,
          recipientEmail: input.recipientEmail ?? "",
          sendDay: input.sendDay ?? "",
        },
      },
    },
  );

  if (error || !data) {
    if (input.requestId) await releaseOrderRequest(supabase, input.requestId);
    const code = knownErrorCode(error?.message, ORDER_MESSAGES);
    if (code) {
      return NextResponse.json(
        { error: code, message: ORDER_MESSAGES[code] },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "ORDER_FAILED" }, { status: 500 });
  }

  const { data: created } = await supabase
    .from("orders")
    .select("id, pay_token, user_id")
    .eq("id", data.order_id)
    .maybeSingle();
  const order = created as {
    id: string;
    pay_token: string;
    user_id: string | null;
  } | null;

  if (input.requestId && order) {
    await completeOrderRequest(supabase, input.requestId, order.id);
  }
  if (order) {
    await captureOrderContext(supabase, order.id, req);
    // Төлбөрийн хуудас ч invoice-гүй бол дахин оролдоно.
    await ensureInvoice(supabase, {
      id: order.id,
      order_no: data.order_no,
      total: data.total,
      user_id: order.user_id,
    });
  }

  return NextResponse.json({
    orderNo: data.order_no,
    total: data.total,
    payToken: order?.pay_token ?? null,
    qpayMock: isQpayMockMode(),
  });
}

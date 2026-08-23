import { NextResponse } from "next/server";
import { revalidatePublic } from "@/lib/cache";
import { checkoutSchema } from "@/lib/validators/order";
import {
  BundleUnavailableError,
  computeSummary,
  priceGiftLines,
  UndeliverableZoneError,
} from "@/features/checkout/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { callRpc } from "@/lib/supabase/rpc";
import { RESERVE_TIMEOUT_MINUTES } from "@/lib/constants";
import { env } from "@/lib/env";
import { createInvoice, isQpayMockMode } from "@/lib/payments/qpay";
import { notifyAdmin, tgEscape } from "@/lib/notify/telegram";
import { formatPrice } from "@/lib/format";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  // Authoritative server-side pricing.
  let summary;
  try {
    summary = await computeSummary(input);
  } catch (e) {
    if (e instanceof UndeliverableZoneError) {
      return NextResponse.json({ error: "ZONE_UNAVAILABLE" }, { status: 400 });
    }
    if (e instanceof BundleUnavailableError) {
      return NextResponse.json(
        { error: "BUNDLE_UNAVAILABLE" },
        { status: 409 },
      );
    }
    throw e;
  }
  if (summary.lines.length === 0) {
    return NextResponse.json({ error: "EMPTY_CART" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Resolve the signed-in user (if any) so the order attaches to their account
  // and loyalty earn/redeem applies. Guests place orders with a null user_id.
  let userId: string | null = null;
  const sessionClient = await createClient();
  if (sessionClient) {
    const {
      data: { user },
    } = await sessionClient.auth.getUser();
    userId = user?.id ?? null;
  }

  if (supabase) {
    // Monthly gift samples: the allowance is one 1ml pick per full 200,000₮
    // of goods value AFTER the coupon (questions.md №3), so validate the
    // coupon here the same way place_order will and price the picks against
    // the discounted figure.
    let giftLines: Awaited<ReturnType<typeof priceGiftLines>> = [];
    if (input.giftProductIds.length > 0) {
      let discount = 0;
      if (input.couponCode) {
        const { data: couponCheck } = await callRpc<{
          valid: boolean;
          discount?: number;
        }>(supabase, "validate_coupon", {
          p_code: input.couponCode,
          p_subtotal: summary.subtotal,
          p_user: userId,
        });
        if (couponCheck?.valid) discount = couponCheck.discount ?? 0;
      }
      giftLines = await priceGiftLines(
        input.giftProductIds,
        Math.max(summary.subtotal - discount, 0),
      );
    }
    const allLines = [...summary.lines, ...giftLines];

    // Reserve inventory + create order atomically via RPC (development.md §6).
    const rpcArgs: Record<string, unknown> = {
      p_order: {
        user_id: userId,
        payment_method: input.paymentMethod,
        contact_name: input.contactName,
        contact_phone: input.contactPhone,
        contact_email: input.contactEmail || null,
        ship_city: input.shipCity,
        ship_district: input.shipDistrict ?? null,
        ship_detail: input.shipDetail,
        // The resolved zone, which may differ from the one the form showed.
        ship_zone: summary.shipZone,
        note: input.note ?? null,
        shipping_fee: summary.shippingFee,
        coupon_code: input.couponCode ?? null,
        loyalty_used: userId ? input.loyaltyUsed : 0,
        reserve_minutes: RESERVE_TIMEOUT_MINUTES,
      },
      p_items: allLines.map((l) => {
        const base = {
          product_id: l.productId,
          variant_id: l.variantId,
          ml: l.ml,
          qty: l.qty,
        };
        // Bundle lines carry a server-computed unit price + grouping, and a
        // monthly gift sample is a 0₮ line; loose items send none so
        // place_order charges the variant's list price.
        if (l.collectionName !== undefined || l.isGift) {
          return {
            ...base,
            unit_price: l.unitPrice,
            is_gift: l.isGift ?? false,
            collection_id: l.collectionId ?? null,
            collection_name: l.collectionName ?? null,
          };
        }
        return base;
      }),
    };
    const { data, error } = await callRpc<{
      order_no: string;
      total: number;
    }>(supabase, "place_order", rpcArgs);

    if (error) {
      const insufficient = error.message?.includes("INSUFFICIENT_STOCK");
      return NextResponse.json(
        { error: insufficient ? "OUT_OF_STOCK" : "ORDER_FAILED" },
        { status: insufficient ? 409 : 500 },
      );
    }

    const orderNo = data?.order_no ?? "";
    const total = data?.total ?? summary.total;

    // Save the shipping address to the user's address book when requested.
    if (userId && input.saveAddress) {
      await supabase.from("addresses").insert({
        user_id: userId,
        label: input.shipDistrict || input.shipCity,
        recipient: input.contactName,
        phone: input.contactPhone,
        city: input.shipCity,
        district: input.shipDistrict ?? null,
        detail: input.shipDetail,
      });
    }

    let qpay = null;

    if (input.paymentMethod === "qpay" && orderNo) {
      const invoice = await createInvoice({
        orderNo,
        amount: total,
        callbackUrl: `${env.siteUrl}/api/payments/qpay/webhook?order=${encodeURIComponent(orderNo)}`,
      });
      if (invoice) {
        qpay = {
          invoiceId: invoice.invoiceId,
          qrText: invoice.qrText,
          qrImage: invoice.qrImage,
        };
        await supabase
          .from("orders")
          .update({ qpay_invoice_id: invoice.invoiceId })
          .eq("order_no", orderNo);
      }
    }

    // Stock moved — refresh cached product pages so sold-out states stay honest.
    revalidatePublic();

    // Best-effort admin ping (no-op until Telegram env is set).
    const { data: created } = await supabase
      .from("orders")
      .select("id")
      .eq("order_no", orderNo)
      .maybeSingle();
    const itemList = allLines
      .map(
        (l) =>
          `• ${tgEscape(l.name)} ${l.ml}ml × ${l.qty}` +
          (l.isGift ? " 🎁" : ""),
      )
      .join("\n");
    await notifyAdmin(
      `🛒 <b>Шинэ захиалга</b> — ${tgEscape(orderNo)}\n` +
        `👤 ${tgEscape(input.contactName)} · ${tgEscape(input.contactPhone)}\n` +
        `📍 ${tgEscape([input.shipCity, input.shipDistrict, input.shipDetail].filter(Boolean).join(", "))}\n\n` +
        `${itemList}\n\n` +
        `💰 ${formatPrice(total)} · ${input.paymentMethod === "qpay" ? "QPay" : "Банкны шилжүүлэг"}` +
        (created?.id ? `\n🔗 ${env.siteUrl}/admin/orders/${created.id}` : ""),
    );
    return NextResponse.json({
      orderNo,
      total,
      paymentMethod: input.paymentMethod,
      summary,
      qpay,
      qpayMock: isQpayMockMode(),
    });
  }

  // Demo fallback (no DB): generate an order number so the flow completes.
  const orderNo = `VS-${Date.now().toString().slice(-7)}`;
  const total = summary.total;
  let qpay = null;

  if (input.paymentMethod === "qpay") {
    const invoice = await createInvoice({
      orderNo,
      amount: total,
      callbackUrl: `${env.siteUrl}/api/payments/qpay/webhook?order=${encodeURIComponent(orderNo)}`,
    });
    if (invoice) {
      qpay = {
        invoiceId: invoice.invoiceId,
        qrText: invoice.qrText,
        qrImage: invoice.qrImage,
      };
    }
  }

  return NextResponse.json({
    orderNo,
    total,
    paymentMethod: input.paymentMethod,
    summary,
    qpay,
    qpayMock: isQpayMockMode(),
    demo: true,
  });
}

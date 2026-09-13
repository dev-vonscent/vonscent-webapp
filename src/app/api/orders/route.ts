import { NextResponse } from "next/server";
import { revalidatePublic } from "@/lib/cache";
import { checkoutSchema } from "@/lib/validators/order";
import {
  BundleUnavailableError,
  computeSummary,
  ItemsUnavailableError,
  priceGiftLines,
  UndeliverableZoneError,
} from "@/features/checkout/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { callRpc } from "@/lib/supabase/rpc";
import { RESERVE_TIMEOUT_MINUTES } from "@/lib/constants";
import { env } from "@/lib/env";
import { isQpayMockMode } from "@/lib/payments/qpay";
import { ensureInvoice } from "@/lib/payments/invoice";
import { notifyAdmin, tgEscape } from "@/lib/notify/telegram";
import { formatPrice } from "@/lib/format";
import { isPhoneEmail } from "@/lib/auth/phone-email";
import { earliestDeliveryDay, latestDeliveryDay } from "@/lib/time";
import { enforceRateLimit } from "@/lib/rate-limit";

/** Клиентээс ирсэн өдрийг [маргааш, маргааш+30] мужид оруулна. */
function clampDeliveryDay(value: string | undefined): string {
  const min = earliestDeliveryDay();
  const max = latestDeliveryDay();
  if (!value || value < min) return min;
  return value > max ? max : value;
}

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

  // Үнэ тооцох, нөөц барих хүнд ажлаас ӨМНӨ. Зочин ч захиалга үүсгэж чаддаг
  // тул түлхүүр нь IP — checkout-д нэвтэрсэн байх шаардлага байхгүй.
  const limited = await enforceRateLimit("order", req);
  if (limited) return limited;

  // Authoritative server-side pricing.
  let summary;
  try {
    summary = await computeSummary(input);
  } catch (e) {
    if (e instanceof UndeliverableZoneError) {
      return NextResponse.json({ error: "ZONE_UNAVAILABLE" }, { status: 400 });
    }
    if (e instanceof ItemsUnavailableError) {
      // The cart outlived the catalogue — the browser drops these lines and
      // tells the customer, rather than us charging for what was left.
      return NextResponse.json(
        { error: "ITEMS_UNAVAILABLE", variantIds: e.variantIds },
        { status: 409 },
      );
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
    // Бэлгийн 1мл дээж: эрх нь купоны дараах барааны дүнгийн 200,000₮ тутамд
    // 1, эсвэл preset 5/10/20мл багцын баталгаа — алийг нь ихийг нь (src/lib/
    // gift.ts). Тиймээс купоныг энд place_order-той ижил аргаар шалгаад
    // хямдарсан дүнгээр эрхийг бодно. Сонголт бүр серверт дахин шалгагдана —
    // сан дотор байгаа эсэх, үлдэгдэл, эрхийн тоо.
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
        summary.giftGuarantee,
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
        // A phone account's synthetic Supabase address is internal plumbing —
        // it must never be stored as if the customer had given us an email.
        contact_email:
          input.contactEmail && !isPhoneEmail(input.contactEmail)
            ? input.contactEmail
            : null,
        ship_city: input.shipCity,
        ship_district: input.shipDistrict ?? null,
        ship_detail: input.shipDetail,
        // The resolved zone, which may differ from the one the form showed.
        ship_zone: summary.shipZone,
        note: input.note ?? null,
        shipping_fee: summary.shippingFee,
        coupon_code: input.couponCode ?? null,
        loyalty_used: userId ? input.loyaltyUsed : 0,
        // Хүргэх өдөр: маргаашаас 30 хоногийн дотор. Хязгаарыг энд бас
        // барина — place_order хэдийнэ өнөөдрөөс өмнөх өдрийг татдаг ч
        // «3 сарын дараа» гэсэн захиалга нөөцөө тэр хугацаанд түгжих болно.
        deliver_on: clampDeliveryDay(input.deliverOn),
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
        // бэлгийн 1мл дээж нь 0₮ мөр; loose items send none so
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

    // The order exists but is **pending**: `place_order` only reserves stock.
    // It becomes `confirmed` in mark_order_paid, i.e. after the money lands.
    // `pay_token` (0068) is how the customer reaches /pay/<token>.
    const { data: created } = await supabase
      .from("orders")
      .select("id, pay_token, user_id")
      .eq("order_no", orderNo)
      .maybeSingle();
    const order = created as {
      id: string;
      pay_token: string;
      user_id: string | null;
    } | null;

    // Invoice creation goes through ensureInvoice so one order can never end
    // up with two live QPay invoices — QPay does not enforce
    // sender_invoice_no uniqueness (qpay/FINDINGS.md §2). If it fails here the
    // order still stands: the payment page retries on open.
    if (input.paymentMethod === "qpay" && order) {
      await ensureInvoice(supabase, {
        id: order.id,
        order_no: orderNo,
        total,
        user_id: order.user_id,
      });
    }

    // Stock moved — refresh cached product pages so sold-out states stay honest.
    revalidatePublic();

    // Best-effort admin ping (no-op until Telegram env is set).
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
        (order?.id ? `\n🔗 ${env.siteUrl}/admin/orders/${order.id}` : ""),
    );
    // The browser only needs the token: the QR, the deeplinks and the live
    // payment state all come from the server when /pay/<token> renders.
    return NextResponse.json({
      orderNo,
      total,
      paymentMethod: input.paymentMethod,
      payToken: order?.pay_token ?? null,
      summary,
      qpayMock: isQpayMockMode(),
    });
  }

  // Demo fallback (no DB): there is nothing to persist and no token to issue,
  // so the browser gets the order number and stops at the confirmation copy.
  const orderNo = `VS-${Date.now().toString().slice(-7)}`;
  return NextResponse.json({
    orderNo,
    total: summary.total,
    paymentMethod: input.paymentMethod,
    payToken: null,
    summary,
    qpayMock: isQpayMockMode(),
    demo: true,
  });
}

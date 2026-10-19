import { NextResponse } from "next/server";
import { revalidatePublic } from "@/lib/cache";
import {
  checkoutOrderSchema,
  detailMissing,
  stripDetail,
} from "@/lib/validators/order";
import { isRemoteAddress } from "@/lib/geo/zone";
import { getShippingSettings } from "@/features/content/api";
import {
  BundleUnavailableError,
  computeSummary,
  InsufficientStockError,
  ItemsUnavailableError,
  UndeliverableZoneError,
} from "@/features/checkout/api";
import {
  placeOrderError,
  toPlacedSummary,
  type OrderSummaryRow,
} from "@/features/checkout/place-order-result";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { callRpc } from "@/lib/supabase/rpc";
import { RESERVE_TIMEOUT_MINUTES, SHIPPING_ZONES } from "@/lib/constants";
import { isQpayMockMode } from "@/lib/payments/qpay";
import { ensureInvoice } from "@/lib/payments/invoice";
import { sendOrderCustomerEmail } from "@/lib/notify/customer-email";
import { earliestDeliveryDay, latestDeliveryDay } from "@/lib/time";
import { enforceRateLimit } from "@/lib/rate-limit";
import {
  claimOrderRequest,
  completeOrderRequest,
  releaseOrderRequest,
} from "@/lib/orders/idempotency";
import {
  SAVED_CHECKOUT_MAX_BYTES,
  savedCheckoutInputSchema,
} from "@/lib/validators/saved-checkout";

/**
 * Давтагдсан идемпотентын түлхүүрийн хариу — анхны захиалгын хариуг сэргээнэ.
 *
 * Клиент энэ хоёрыг ялгаж мэдэхгүй байх ёстой: «дахин илгээх» нь анхны
 * илгээлттэй яг ижил үр дүн өгнө. `summary` нь САНГААС уншсан хураангуй
 * (`order_summary`, 0149) — мөрийн дараалал, хасагдсан бэлэг, дүн нь анхны
 * хариутай ижил (§6.2 №8).
 */
async function describeExistingOrder(
  supabase: NonNullable<ReturnType<typeof createAdminClient>>,
  orderId: string,
) {
  const [{ data }, { data: summaryRow }] = await Promise.all([
    supabase
      .from("orders")
      .select("order_no, total, payment_method, pay_token")
      .eq("id", orderId)
      .maybeSingle(),
    callRpc<OrderSummaryRow>(supabase, "order_summary", { p_order: orderId }),
  ]);
  const order = data as {
    order_no: string;
    total: number;
    payment_method: string;
    pay_token: string | null;
  } | null;
  return {
    orderNo: order?.order_no ?? "",
    total: order?.total ?? 0,
    paymentMethod: order?.payment_method ?? "qpay",
    payToken: order?.pay_token ?? null,
    summary: summaryRow ? toPlacedSummary(summaryRow) : null,
    qpayMock: isQpayMockMode(),
    /** Клиентэд мэдээлэл болгож л явна — урсгал нь ижил. */
    deduplicated: true,
  };
}

/**
 * Checkout-ийн сагсны хуулбар (0124) — төлөгдөөгүй захиалга «Дараа захиалах»
 * руу шилжихэд хэрэглэгдэнэ. Захиалгын нэг хэсэг биш: буруу, хэт том бол
 * зүгээр л хаягдана, захиалга зогсохгүй.
 */
function parseSnapshot(body: unknown) {
  const raw = (body as { snapshot?: unknown } | null)?.snapshot;
  if (raw === undefined) return null;
  const parsed = savedCheckoutInputSchema.safeParse(raw);
  if (!parsed.success) return null;
  if (JSON.stringify(parsed.data).length > SAVED_CHECKOUT_MAX_BYTES)
    return null;
  return parsed.data;
}

/** Клиентээс ирсэн өдрийг [маргааш, маргааш+30] мужид оруулна. */
function clampDeliveryDay(value: string | undefined): string {
  const min = earliestDeliveryDay();
  const max = latestDeliveryDay();
  if (!value || value < min) return min;
  return value > max ? max : value;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = checkoutOrderSchema.safeParse(body);
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

  // Дэлгэрэнгүй хаяг: үүдэнд хүргэх хаягт заавал, унаагаар явах хаягт
  // (орон нутаг, Налайх гэх мэт R бүс) хадгалахгүй — хуучин хадгалсан хаяг
  // гэрийн хаягаа авч ирсэн ч захиалга дээр «гэрт хүргэнэ» мэт үлдэхгүй.
  const shipping = await getShippingSettings();
  const zones = shipping.zones?.length ? shipping.zones : [...SHIPPING_ZONES];
  const remote = isRemoteAddress(zones, {
    city: input.shipCity,
    district: input.shipDistrict,
    khoroo: input.shipKhoroo,
  });
  if (remote) {
    input.shipDetail = stripDetail(input.shipDetail);
  } else if (detailMissing(input.shipDetail)) {
    return NextResponse.json({ error: "DETAIL_REQUIRED" }, { status: 400 });
  }

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
    if (e instanceof InsufficientStockError) {
      // Хэмжээ бүр дангаараа зарагдах ч нийлбэр нь эх савны үлдэгдлээс давсан
      // (10ml×2, эсвэл 10ml + 5ml). Аль бараа, хэд болгохыг нэрлэж буцаана —
      // браузар сагсаа тэр дороо засна.
      return NextResponse.json(
        { error: "INSUFFICIENT_STOCK", items: e.items },
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
  // Зөвхөн нэмэлт бараатай захиалга ч болно (§2.1 №10).
  if (summary.lines.length === 0 && input.extras.length === 0) {
    return NextResponse.json({ error: "EMPTY_CART" }, { status: 400 });
  }
  // Туг хаалттай үед нэмэлт бараа захиалагдахгүй — SQL ч татгалзана
  // (EXTRAS_DISABLED), энэ нь route-ийн давхар шалгалт.
  if (input.extras.length > 0 && !(await isFeatureEnabled("extras_shop"))) {
    return NextResponse.json({ error: "EXTRAS_DISABLED" }, { status: 409 });
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

  // Купон ба V point зөвхөн бүртгэлтэй хэрэглэгчид (0104). place_order ч мөн
  // зочны кодыг үл хэрэгсдэг, гэхдээ чимээгүй хаявал хэрэглэгч хүлээж байсан
  // хөнгөлөлтгүй захиалга үүсгэнэ — тиймээс энд тод татгалзана.
  if (!userId && (input.couponCode || input.loyaltyUsed > 0)) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  }

  if (supabase) {
    // Идемпотентын эзэмшил — нөөц түгжих, захиалга үүсгэх, QPay руу залгахаас
    // БҮГДЭЭС нь өмнө. Сүлжээ тасарч хариу нь алдагдсан үед хэрэглэгч дахин
    // илгээхэд шинэ захиалга үүсэхгүй, байгаагийнх нь дугаар буцна (0087).
    if (input.requestId) {
      const claim = await claimOrderRequest(supabase, input.requestId);
      if (!claim.won) {
        if (!claim.existingOrderId) {
          // Ялагч амжаагүй. Давхар захиалга үүсгэхээс татгалзана.
          return NextResponse.json({ error: "ORDER_PENDING" }, { status: 409 });
        }
        return NextResponse.json(
          await describeExistingOrder(supabase, claim.existingOrderId),
        );
      }
    }

    // Бэлгийн 1мл дээж (0149): эрх (купоны дараах барааны дүнгийн 200,000₮
    // тутамд 1), сан, үлдэгдэл, 1ml сав — бүгд `place_order` дотор, нэг
    // transaction-д. Эрхээс илүү эсвэл дууссан сонголт захиалгыг зогсоохгүй,
    // `omitted_gifts`-д хадгалагдаж хэрэглэгчид мэдэгдэнэ.

    // Reserve inventory + create order atomically via RPC (development.md §6).
    const rpcArgs: Record<string, unknown> = {
      p_order: {
        user_id: userId,
        payment_method: input.paymentMethod,
        contact_name: input.contactName,
        contact_phone: input.contactPhone,
        // `contact_email` дахин бичигдэж эхэллээ. Өмнө нь хасагдсан шалтгаан
        // нь «хадгалагдаад ашиглагддаггүй» байсан — `sendOrderCustomerEmail`
        // зөвхөн `newsletter_subscribers.email` рүү илгээдэг байв. Одоо энэ
        // хаяг нь зочны захиалгаа дахин олох гол зам: захиалгын дугаар ба
        // төлбөрийн линк энд очно (`customer-email.ts`-ийн хүлээн авагчийн
        // дараалал). Хоосон мөрийг NULL болгоно.
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
        // Хүргэх өдөр: маргаашаас 30 хоногийн дотор. Хязгаарыг энд бас
        // барина — place_order хэдийнэ өнөөдрөөс өмнөх өдрийг татдаг ч
        // «3 сарын дараа» гэсэн захиалга нөөцөө тэр хугацаанд түгжих болно.
        deliver_on: clampDeliveryDay(input.deliverOn),
        reserve_minutes: RESERVE_TIMEOUT_MINUTES,
        gift_product_ids: input.giftProductIds,
        // Хэрэглэгчийн баталсан дүн (§6.2 №5) — SQL дахин бодсон дүн
        // зөрвөл захиалга үүсэхгүй, шинэ дүнг буцаана.
        ...(input.expected
          ? {
              expected: {
                subtotal: input.expected.subtotal,
                discount: input.expected.discount,
                loyalty_used: input.expected.loyaltyUsed,
                shipping_fee: input.expected.shippingFee,
                total: input.expected.total,
              },
            }
          : {}),
      },
      p_items: [
        ...summary.lines.map((l) => {
          const base = {
            product_id: l.productId,
            variant_id: l.variantId,
            ml: l.ml,
            qty: l.qty,
          };
          // Багцын мөр серверийн бодсон хямдарсан үнэтэй, бүлэглэлтэй;
          // сул мөрийн үнийг place_order сангаас авна.
          if (l.collectionName !== undefined) {
            return {
              ...base,
              kind: "bundle",
              unit_price: l.unitPrice,
              collection_id: l.collectionId ?? null,
              collection_name: l.collectionName ?? null,
            };
          }
          return { ...base, kind: "perfume" };
        }),
        ...input.extras.map((e) => ({
          kind: "extra",
          extra_variant_id: e.extraVariantId,
          qty: e.qty,
          expected_unit_price: e.expectedUnitPrice,
        })),
      ],
    };
    let { data, error } = await callRpc<OrderSummaryRow>(
      supabase,
      "place_order",
      rpcArgs,
    );
    // Deadlock (40P01) — бүх нөөцийг нэг дарааллаар түгжих ч өдрийн cron
    // batch зэрэг ажиллахад ховор тохиолдоно. Transaction бүхэлдээ буцсан тул
    // нэг удаа дахин оролдоход аюулгүй.
    if (error && /deadlock detected/i.test(error.message)) {
      ({ data, error } = await callRpc<OrderSummaryRow>(
        supabase,
        "place_order",
        rpcArgs,
      ));
    }

    if (error || !data) {
      // Захиалга үүсээгүй тул эзэмшлийг суллана — хэрэглэгч сагсаа засаад
      // ижил түлхүүрээр дахин оролдох ёстой.
      if (input.requestId) await releaseOrderRequest(supabase, input.requestId);
      // Үлдэгдэл, сав, үнэ, баталсан дүн (0149) — бүгд нэг хөрвүүлэгчээр.
      // Энд хүртэл ирсэн нөөцийн алдаа нь захиалга явж байх зуур өөр хүн
      // авсан, эсвэл админ өөрчилсөн гэсэн үг (computeSummary цэвэр өнгөрсөн).
      const known = placeOrderError(error?.message);
      if (known) return NextResponse.json(known.body, { status: known.status });
      return NextResponse.json({ error: "ORDER_FAILED" }, { status: 500 });
    }

    const placed = toPlacedSummary(data);
    const orderNo = placed.orderNo;
    const total = placed.total;

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
      .eq("id", placed.orderId)
      .maybeSingle();
    const order = created as {
      id: string;
      pay_token: string;
      user_id: string | null;
    } | null;

    // Эзэмшлийг захиалгад холбоно — ижил түлхүүртэй хүлээж буй хүсэлт байвал
    // яг энэ захиалгыг авна. Invoice үүсгэхээс өмнө: тэр нь QPay руу залгадаг
    // тул удаан, харин хүлээгч талыг тэр болтол саатуулах шалтгаан байхгүй.
    if (input.requestId && order) {
      await completeOrderRequest(supabase, input.requestId, order.id);
    }

    // «Дараа захиалах» нь бүртгэлд хадгалагддаг тул зочинд хуулбар хэрэггүй.
    const snapshot = userId && order ? parseSnapshot(body) : null;
    if (snapshot && order) {
      await supabase
        .from("orders")
        .update({ checkout_snapshot: snapshot })
        .eq("id", order.id);
    }

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

    // Захиалгын дугаар ба төлбөрийн линкийг хэрэглэгч рүү. Зочны хувьд энэ нь
    // захиалгаа дахин олох цорын ганц шууд зам — `/pay/<token>`-оос гарчихвал
    // өөр буцах хаалга байхгүй. Best-effort: имэйл унасан ч захиалга зогсохгүй.
    if (order) await sendOrderCustomerEmail(order.id, "placed");

    // Админ руу Telegram дохио ЭНД явуулахгүй. Захиалга үүсэх нь зөвхөн нөөц
    // барьсан гэсэн үг — төлбөр ороогүй, reserve timeout-оор цуцлагдаж ч
    // мэднэ. Дохио нь төлбөр баталгаажих мөчид, `confirm-order.ts`-ийн
    // `commit()` дотроос нэг л удаа явна.
    // The browser only needs the token: the QR, the deeplinks and the live
    // payment state all come from the server when /pay/<token> renders.
    return NextResponse.json({
      orderNo,
      total,
      paymentMethod: input.paymentMethod,
      payToken: order?.pay_token ?? null,
      // Сангаас — хадгалсан мөр, хасагдсан бэлэг, дүн (§6.2 №6).
      summary: placed,
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

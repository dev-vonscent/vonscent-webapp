import "server-only";

import { NextResponse } from "next/server";
import { isQpayMockMode } from "@/lib/payments/qpay";
import { verifyAndMarkOrderPaidByOrderNo } from "@/lib/payments/confirm-order";
import { enforceRateLimit } from "@/lib/rate-limit";

/**
 * QPay payment callback (development.md §7.5).
 *
 * **Дуудагч итгэлгүй.** QPay нь callback-даа гарын үсэг өгдөггүй — V2-ийн
 * албан ёсны баримтад HMAC ч, signature ч, IP allowlist ч байхгүй бөгөөд
 * QPay-ийн онбординг захидал нь шууд «Төлбөр амжилттай төлөгдсөн мэдээллийг
 * callback URL-аар хүлээн авсны дараа **шалгаж баталгаажуулна уу**» гэж
 * зөвлөдөг. Тиймээс энэ handler ирсэн өгөгдлийг огт уншихгүй: захиалгын
 * дугаарыг л аваад QPay-ээс `payment/check`-ээр дахин асууж, зөвхөн тэндээс
 * батлагдсан үед л `mark_order_paid` дуудна. Хуурамч хүсэлтээр захиалгыг
 * «төлөгдсөн» болгох боломжгүй.
 *
 * Гэхдээ гарын үсэггүй гэдэг нь нээлттэй байх ёстой гэсэн үг биш. `order_no`
 * нь `VS-1000`, `VS-1001` … гэсэн дараалсан sequence (0006) тул нууцгүй
 * endpoint нь хоёр зүйлийг алдана:
 *
 *   1. **Тандалт** — status code бүр өөр байсан тул VS-1000..VS-9999 гүйлгээд
 *      захиалга бүрийн оршин буй эсэх, төлбөрийн төлвийг зурагласан болно.
 *   2. **Хүчитгэгч** — `NOT_PAID` хариу бүр QPay руу нэг бодит
 *      `payment/check` илгээдэг тул танихгүй хүн мерчантын квотыг шатааж,
 *      бодит баталгаажуулалтыг удаашруулж чадна.
 *
 * Тиймээс зам дотор нууц сегмент (`QPAY_CALLBACK_SECRET`) + хурдны хязгаар.
 */
export async function handleQpayCallback(
  req: Request,
  bodyOrderNo?: string,
): Promise<Response> {
  if (isQpayMockMode()) {
    return NextResponse.json({ error: "MOCK_MODE" }, { status: 403 });
  }

  // Нууцаар хамгаалагдсан зам ч гэсэн хязгаартай: нууц алдагдвал энэ нь
  // хоёр дахь давхарга болно.
  const limited = await enforceRateLimit("qpayWebhook", req);
  if (limited) return limited;

  const url = new URL(req.url);
  const orderNo = url.searchParams.get("order") ?? bodyOrderNo ?? "";

  const result = await verifyAndMarkOrderPaidByOrderNo(orderNo);
  if (!result.ok) {
    // 5xx is "try again"; everything terminal must be 4xx so QPay stops
    // retrying. ORDER_CANCELLED is terminal by definition — the order will
    // never accept this payment, and an admin has already been notified.
    const status =
      result.error === "MISSING_ORDER"
        ? 400
        : result.error === "ORDER_NOT_FOUND"
          ? 404
          : result.error === "NOT_PAID" || result.error === "NO_INVOICE"
            ? 402
            : result.error === "ORDER_CANCELLED"
              ? 409
              : 502;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({
    ok: true,
    demo: result.demo,
    alreadyPaid: result.alreadyPaid,
  });
}

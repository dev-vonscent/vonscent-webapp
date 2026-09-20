import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAndMarkOrderPaid } from "@/lib/payments/confirm-order";
import { isQpayMockMode } from "@/lib/payments/qpay";
import { cancelOrderInvoice } from "@/lib/payments/cancel-invoice";
import { env } from "@/lib/env";

/**
 * Цуцлахын өмнөх эцсийн төлбөрийн шалгалт.
 *
 * **Яагаад байх ёстой вэ.** Захиалга `paid` болох хоёрхон зам байсан:
 * QPay-ийн callback, эсвэл хэрэглэгч `/pay/<token>`-оо дахин нээх. Хоёулаа
 * унавал — callback алдагдаж (cold start, deploy явж байсан, 5xx), хэрэглэгч
 * төлчихөөд browser-оо хаавал — `release_expired_reserves` нь QPay-ээс огт
 * асуулгүйгээр захиалгыг цуцалдаг. Мөнгө гарсан, захиалга цуцлагдсан, админд
 * ямар ч дохио очдоггүй.
 *
 * **Яагаад энэ нь polling БИШ вэ.** QPay-ийн баримт «Cron job ашиглан
 * гүйлгээг байнга шалгахыг хориглоно» гэж шууд заадаг бөгөөд энэ нь зөв:
 * `payment/check`-ийг давтан татах нь тэдний квотыг иддэг. Тиймээс энэ route
 * нь бүх төлөгдөөгүй захиалгыг сканнердахгүй — зөвхөн **нөөцийн хугацаа нь
 * дуусах гэж буй** захиалгыг л авна. Захиалга тутамд амьдралынхаа туршид
 * дээд тал нь нэг нэмэлт `payment/check` явна, тэр нь захиалга үүрд
 * цуцлагдахаас өмнөх сүүлчийн боломж дээр. Энэ бол давтамжит хяналт биш,
 * буцаагдашгүй үйлдлийн өмнөх нэг удаагийн баталгаа.
 *
 * Хэвийн урсгалд (callback ирсэн, эсвэл хэрэглэгч хуудсандаа байгаа) энэ
 * route юу ч олохгүй: захиалга аль хэдийн `paid` болсон байна.
 *
 * **Шинэ логик бичихгүй.** Бүх шийдвэр `verifyAndMarkOrderPaid`-д —
 * QPay-ээс `payment/check`, дүнгийн шалгалт, цуцлагдсан захиалгын
 * `admin_notifications` + Telegram дохио. Энэ route бол зөвхөн хуваарь.
 */

/** Нэг ажиллахад шалгах захиалгын дээд тоо — QPay-ийн квотыг хамгаална. */
const BATCH = 50;
/**
 * Нөөц дуусахаас хэдэн минутын өмнө эцсийн шалгалт хийх вэ.
 *
 * Cron нь 5 минут тутам ажилладаг тул 6 минут нь захиалга бүрийг цуцлагдахаас
 * өмнө **дор хаяж нэг удаа** барих баталгаа өгнө (5 < 6). Үүнээс их болгох нь
 * захиалга тутамд илүү олон дуудлага үүсгэнэ — QPay-ийн «байнга шалгах»
 * хоригтой яг тэр чиглэлд.
 */
const PRE_EXPIRY_MINUTES = 6;

export const dynamic = "force-dynamic";

function authorised(req: Request): boolean {
  if (!env.cronSecret) return false;
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${env.cronSecret}`;
  // Урт нь зөрөх үед `timingSafeEqual` шидэлт хийдэг тул эхлээд шалгана.
  if (header.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

export async function GET(req: Request) {
  // Нууц тавигдаагүй бол route нь ажиллахгүй. Нээлттэй орхих нь энэ endpoint-ыг
  // QPay рүү чиглэсэн хүчитгэгч болгоно.
  if (!env.cronSecret) {
    return NextResponse.json({ error: "CRON_NOT_CONFIGURED" }, { status: 503 });
  }
  if (!authorised(req)) {
    return NextResponse.json({ error: "UNAUTHORISED" }, { status: 401 });
  }
  // Mock орчинд QPay гэж байхгүй — тулгах зүйл ч байхгүй.
  if (isQpayMockMode()) {
    return NextResponse.json({ ok: true, skipped: "MOCK_MODE" });
  }

  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ ok: true, demo: true });

  // Нөөц нь дараагийн `PRE_EXPIRY_MINUTES` дотор дуусах, QPay invoice-той,
  // төлөгдөөгүй, хараахан цуцлагдаагүй захиалгууд. Өөрөөр хэлбэл «яг одоо
  // үүрд алдагдах гэж буй» захиалгууд — өөр юу ч энд орохгүй.
  //
  // Цуцлагдсаныг ОРУУЛАХГҮЙ: тэдгээрт мөнгө орвол callback өөрөө ирж
  // `ORDER_CANCELLED` салаагаар админд дуудна. Тэднийг сканнердах нь
  // QPay-ийн хоригтой «байнга шалгах» руу буцаана.
  const cutoff = new Date(
    Date.now() + PRE_EXPIRY_MINUTES * 60 * 1000,
  ).toISOString();

  const { data, error } = await supabase
    .from("orders")
    .select("id, order_no")
    .eq("payment_status", "unpaid")
    .eq("status", "pending")
    .not("qpay_invoice_id", "is", null)
    .not("reserve_expires_at", "is", null)
    .lte("reserve_expires_at", cutoff)
    .order("reserve_expires_at", { ascending: true })
    .limit(BATCH);

  if (error) {
    return NextResponse.json({ error: "QUERY_FAILED" }, { status: 500 });
  }

  const orders = (data as { id: string; order_no: string }[] | null) ?? [];
  let confirmed = 0;
  let cancelledWithPayment = 0;
  const failures: string[] = [];

  // Дараалан: зэрэг ажиллуулбал QPay рүү 50 зэрэгцээ дуудлага явна.
  for (const order of orders) {
    const result = await verifyAndMarkOrderPaid(order.id);
    if (result.ok) {
      if (!result.alreadyPaid) confirmed += 1;
      continue;
    }
    if (result.error === "ORDER_CANCELLED") {
      // `confirm-order` аль хэдийн админд бичсэн — энд зөвхөн тоолно.
      cancelledWithPayment += 1;
      continue;
    }
    // NOT_PAID бол хэвийн: хэрэглэгч хараахан төлөөгүй байна. Гэхдээ энэ
    // захиалга хэдхэн минутын дараа цуцлагдана — QPay-ийн invoice-ыг ОДОО
    // хаана. Эс тэгвээс утсан дээр нээлттэй үлдсэн QR цуцлагдсаны дараа ч
    // төлөгдөж, гараар буцаах ажил үүсгэнэ.
    if (result.error === "NOT_PAID") {
      await cancelOrderInvoice(order.id);
      continue;
    }
    failures.push(order.order_no);
  }

  return NextResponse.json({
    ok: true,
    scanned: orders.length,
    confirmed,
    cancelledWithPayment,
    failures,
  });
}

import { NextResponse } from "next/server";
import { handleQpayCallback } from "./handler";
import { env } from "@/lib/env";

/**
 * QPay callback — **хуучин, нууцгүй зам**.
 *
 * `QPAY_CALLBACK_SECRET` тохируулагдсан үед энэ зам хаагдана: шинэ invoice
 * бүр нууцтай замыг л `callback_url` болгож авдаг (`callbackUrlFor`).
 *
 * Тохируулаагүй үед ажилласаар байна. Энэ нь зориуд: нэг мартсан env нь
 * төлбөрийн бүх callback-ыг чимээгүй унагаах ёсгүй. Нууц тавигдсаны дараа ч
 * **хуучин invoice-ууд** энэ зам руу заасаар байх тул шууд 404 буцаах нь тэр
 * захиалгуудын callback-ыг таслана — гэхдээ нөөцийн цонх 35 минут учир
 * хамгийн ихдээ 35 минутын invoice л өртөнө, тэдгээрийг төлбөрийн хуудасны
 * poller (3/15 сек) ба тулгалтын cron (5 мин) хоёулаа барина.
 */
export const dynamic = "force-dynamic";

/** Нууц тохируулсан бол энэ зам байхаа больсон гэж хариулна. */
const CLOSED = NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

export async function GET(req: Request) {
  if (env.qpayCallbackSecret) return CLOSED;
  return handleQpayCallback(req);
}

export async function POST(req: Request) {
  if (env.qpayCallbackSecret) return CLOSED;
  const bodyOrderNo = await req
    .json()
    .then((b: { order_no?: string }) => b?.order_no)
    .catch(() => undefined);
  return handleQpayCallback(req, bodyOrderNo);
}

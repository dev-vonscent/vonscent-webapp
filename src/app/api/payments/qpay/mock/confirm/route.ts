import { NextResponse } from "next/server";
import { z } from "zod";
import { isQpayMockMode } from "@/lib/payments/qpay";
import { orderIdForToken } from "@/features/payment/api";
import { markOrderPaid } from "@/lib/payments/confirm-order";

/**
 * Dev-only: simulate a successful QPay payment.
 *
 * Gated on mock mode, so the moment real credentials are present this endpoint
 * refuses — it must never be a way to mark a live order paid for free. It takes
 * the pay token rather than an order number for the same reason the page does:
 * an order number is guessable.
 */
const bodySchema = z.object({ token: z.string().min(8).max(128) });

export async function POST(req: Request) {
  if (!isQpayMockMode()) {
    return NextResponse.json({ error: "NOT_AVAILABLE" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "MISSING_TOKEN" }, { status: 400 });
  }

  const order = await orderIdForToken(parsed.data.token);
  if (!order) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const result = await markOrderPaid(order.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  // Төлбөр батлагдсаны дараа хүргэх өдөр ахисан байж болно (0069).
  const fresh = await orderIdForToken(parsed.data.token);
  return NextResponse.json({
    ok: true,
    demo: result.demo,
    alreadyPaid: result.alreadyPaid,
    deliverOn: fresh?.deliverOn ?? order.deliverOn,
  });
}

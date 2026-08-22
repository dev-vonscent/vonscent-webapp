import { NextResponse } from "next/server";
import { isQpayMockMode } from "@/lib/payments/qpay";
import { verifyAndMarkOrderPaidByOrderNo } from "@/lib/payments/confirm-order";

/**
 * QPay payment callback (development.md §7.5). The caller is untrusted: the
 * order number is public knowledge, so instead of believing the request we
 * re-query QPay for the invoice's payments and only then commit the order
 * (mark_order_paid). In mock mode this endpoint is disabled — simulated
 * payments go through /api/payments/qpay/mock/confirm, which is itself gated
 * to mock mode.
 */
async function handle(req: Request, bodyOrderNo?: string) {
  if (isQpayMockMode()) {
    return NextResponse.json({ error: "MOCK_MODE" }, { status: 403 });
  }

  const url = new URL(req.url);
  const orderNo = url.searchParams.get("order") ?? bodyOrderNo ?? "";

  const result = await verifyAndMarkOrderPaidByOrderNo(orderNo);
  if (!result.ok) {
    const status =
      result.error === "MISSING_ORDER"
        ? 400
        : result.error === "ORDER_NOT_FOUND"
          ? 404
          : result.error === "NOT_PAID" || result.error === "NO_INVOICE"
            ? 402
            : 502;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({
    ok: true,
    demo: result.demo,
    alreadyPaid: result.alreadyPaid,
  });
}

// QPay calls the callback_url with GET; POST is kept for manual re-checks.
export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  const bodyOrderNo = await req
    .json()
    .then((b: { order_no?: string }) => b?.order_no)
    .catch(() => undefined);
  return handle(req, bodyOrderNo);
}

import { NextResponse } from "next/server";
import { markOrderPaidByOrderNo } from "@/lib/payments/confirm-order";

/**
 * QPay payment callback (development.md §7.5). QPay calls this URL with the
 * paid invoice; we verify and commit the order's inventory (mark_order_paid).
 *
 * NOTE: verify the QPay signature / re-query invoice status before trusting the
 * callback in production. Here we look the order up by its number.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const orderNo =
    url.searchParams.get("order") ??
    (await req
      .json()
      .then((b: { order_no?: string }) => b?.order_no)
      .catch(() => undefined));

  const result = await markOrderPaidByOrderNo(orderNo ?? "");
  if (!result.ok) {
    const status =
      result.error === "MISSING_ORDER"
        ? 400
        : result.error === "ORDER_NOT_FOUND"
          ? 404
          : 500;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({
    ok: true,
    demo: result.demo,
    alreadyPaid: result.alreadyPaid,
  });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { orderIdForToken } from "@/features/payment/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAndMarkOrderPaid } from "@/lib/payments/confirm-order";

/**
 * Payment status for the `/pay/[token]` poller.
 *
 * Two modes, because the callback cannot be relied on. QPay pings
 * `callback_url` once; if that request is lost, dropped by a cold start, or
 * the site was mid-deploy, the order would sit unpaid forever while the
 * customer stares at a page insisting it is waiting. So:
 *
 *   - default: read `orders.payment_status` (cheap, safe to poll every few
 *     seconds) — this is what the webhook writes;
 *   - `verify=1`: ask QPay itself via `payment/check` first. The page runs
 *     this on a slow interval and on the "check my payment" button, so a
 *     missed callback self-heals within seconds of the customer looking.
 *
 * Keyed by `pay_token`, never `order_no`: order numbers are sequential, and
 * even a leaked boolean per order number is worth not handing out.
 */
const querySchema = z.object({
  token: z.string().min(8).max(128),
  verify: z.enum(["0", "1"]).optional(),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    token: url.searchParams.get("token") ?? "",
    verify: url.searchParams.get("verify") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "MISSING_TOKEN" }, { status: 400 });
  }

  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ paid: false, demo: true });

  const order = await orderIdForToken(parsed.data.token);
  if (!order) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (order.paid) return NextResponse.json({ paid: true });

  if (parsed.data.verify === "1") {
    const result = await verifyAndMarkOrderPaid(order.id);
    // NOT_PAID / CHECK_FAILED are both "keep waiting" from the page's side —
    // the distinction only matters in logs, so the shape stays a boolean.
    return NextResponse.json({ paid: result.ok === true, verified: true });
  }

  return NextResponse.json({ paid: false });
}

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPaymentByToken } from "@/features/payment/api";
import { PaymentPanel } from "@/features/payment/components/payment-panel";

/**
 * `/pay/<token>` — the payment page.
 *
 * Dynamic and uncached: it reads live payment state and, for an order that has
 * none yet, creates the QPay invoice. Caching it would serve one customer's QR
 * to the next.
 *
 * The token is the authorisation. `order_no` is a sequence (`VS-1000`,
 * `VS-1001`, …), so a page keyed by the order number would let anyone page
 * through other people's orders.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Төлбөр",
  // A payment link may be forwarded or pasted into a chat that unfurls links.
  robots: { index: false, follow: false },
};

export default async function PayPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const view = await getPaymentByToken(token);
  if (!view) notFound();
  return <PaymentPanel view={view} token={token} />;
}

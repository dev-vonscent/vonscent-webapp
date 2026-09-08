import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createInvoice, toDataUrl } from "./qpay";
import type { QpayDeeplink } from "./qpay-types";
import { env } from "@/lib/env";

/**
 * Get-or-create the QPay invoice for an order.
 *
 * **This is the idempotency boundary.** QPay does not enforce
 * `sender_invoice_no` uniqueness — the harness proved two calls with the same
 * order number both return 200 with different `invoice_id`s
 * (`qpay/FINDINGS.md` §2). Two invoices for one order means the customer can
 * pay one while the webhook watches the other, so every path that wants an
 * invoice must come through here rather than calling `createInvoice` directly.
 *
 * The stored row is the source of truth: `GET /invoice/{id}` does not return
 * `qr_image` or the bank deeplinks, so they cannot be re-fetched later.
 */

export interface StoredInvoice {
  invoiceId: string;
  qrText: string;
  /** Ready for `<img src>`. */
  qrImage: string | null;
  shortUrl: string | null;
  deeplinks: QpayDeeplink[];
  amount: number;
}

interface InvoiceRow {
  invoice_id: string;
  qr_text: string;
  qr_image: string | null;
  short_url: string | null;
  deeplinks: QpayDeeplink[] | null;
  amount: number;
}

function fromRow(row: InvoiceRow): StoredInvoice {
  return {
    invoiceId: row.invoice_id,
    qrText: row.qr_text,
    // The column holds QPay's bare base64; the prefix is a display concern.
    qrImage: toDataUrl(row.qr_image),
    shortUrl: row.short_url,
    deeplinks: row.deeplinks ?? [],
    amount: row.amount,
  };
}

/** Strips the `data:` prefix so the column always holds bare base64. */
function toBareBase64(value: string | null): string | null {
  if (!value) return null;
  const comma = value.startsWith("data:") ? value.indexOf(",") : -1;
  return comma >= 0 ? value.slice(comma + 1) : value;
}

export async function readInvoice(
  supabase: SupabaseClient,
  orderId: string,
): Promise<StoredInvoice | null> {
  const { data } = await supabase
    .from("qpay_invoices")
    .select("invoice_id, qr_text, qr_image, short_url, deeplinks, amount")
    .eq("order_id", orderId)
    .maybeSingle();
  return data ? fromRow(data as InvoiceRow) : null;
}

/**
 * Where QPay should ping when the money lands.
 *
 * Defaults to this deployment's own origin. `QPAY_CALLBACK_URL` overrides the
 * origin so a developer can point the callback at a tunnel (or at production)
 * without moving `NEXT_PUBLIC_SITE_URL`, which also drives canonical links,
 * e-mail buttons and admin deep-links.
 *
 * QPay does accept a `http://localhost` callback — measured, 2026-09-08,
 * despite the docs — it simply can never reach it. That is survivable: the
 * payment page re-asks QPay directly (`/api/payments/status?verify=1`), so a
 * callback that never arrives only costs a few seconds.
 */
export function callbackUrlFor(orderNo: string): string {
  const base = (process.env.QPAY_CALLBACK_URL?.trim() || env.siteUrl).replace(
    /\/+$/,
    "",
  );
  const origin = base.replace(/\/api\/payments\/qpay\/webhook.*$/, "");
  return `${origin}/api/payments/qpay/webhook?order=${encodeURIComponent(orderNo)}`;
}

/**
 * Returns the order's invoice, creating one only if it has none.
 *
 * A mock invoice is deliberately **not** persisted: it carries a `Date.now()`
 * id and no real QR, so keeping it would pin a dev artefact onto an order that
 * might later be paid for real.
 */
export async function ensureInvoice(
  supabase: SupabaseClient,
  order: {
    id: string;
    order_no: string;
    total: number;
    user_id?: string | null;
  },
): Promise<StoredInvoice | null> {
  const existing = await readInvoice(supabase, order.id);
  if (existing) return existing;

  const amount = await invoiceAmount(supabase, order);
  const invoice = await createInvoice({
    orderNo: order.order_no,
    amount,
    callbackUrl: callbackUrlFor(order.order_no),
  });
  if (!invoice) return null;

  // Always answer in the stored shape, freshly created or not. Returning the
  // raw `QpayInvoice` here used to drop `amount`, and the payment page — which
  // uses it to warn that a test invoice is asking for less than the order is
  // worth — silently fell back to the order total on the one render that
  // matters most: the first.
  const normalised: StoredInvoice = {
    invoiceId: invoice.invoiceId,
    qrText: invoice.qrText,
    qrImage: invoice.qrImage,
    shortUrl: invoice.shortUrl,
    deeplinks: invoice.deeplinks,
    amount,
  };
  // A mock invoice is deliberately not persisted, but still has to render.
  if (invoice.mock) return normalised;

  // `upsert` rather than `insert`: two tabs can race this, and losing the race
  // must not surface as an error — both callers want the same invoice.
  await supabase.from("qpay_invoices").upsert(
    {
      order_id: order.id,
      invoice_id: invoice.invoiceId,
      qr_text: invoice.qrText,
      qr_image: toBareBase64(invoice.qrImage),
      short_url: invoice.shortUrl,
      deeplinks: invoice.deeplinks,
      // What the customer is actually asked for, which is not always the
      // order total — see `invoiceAmount`. The payment check compares against
      // this, so it has to be the stored figure.
      amount,
    },
    { onConflict: "order_id" },
  );
  await supabase
    .from("orders")
    .update({ qpay_invoice_id: invoice.invoiceId })
    .eq("id", order.id);

  return normalised;
}

/**
 * What to put on the QR.
 *
 * Normally the order total. `QPAY_TEST_AMOUNT` overrides it — but **only for
 * an order placed by a member of staff**, which is what makes the switch safe
 * to leave on. QPay has no sandbox: the only way to watch a real payment land
 * is to actually pay one, and nobody should have to spend 19,000₮ to check
 * that a callback fires. Gating on the buyer rather than on `NODE_ENV` means a
 * customer can never be charged a token amount, not even if the variable is
 * set on production by mistake, and staff can test on the real site.
 *
 * The order's own `total` is untouched: the customer record, the invoice and
 * the reports all still say what the goods cost. Only the sum QPay collects
 * changes, and `qpay_invoices.amount` records it.
 */
async function invoiceAmount(
  supabase: SupabaseClient,
  order: { total: number; user_id?: string | null },
): Promise<number> {
  const test = Number(process.env.QPAY_TEST_AMOUNT ?? 0);
  if (!Number.isFinite(test) || test <= 0) return order.total;
  if (!order.user_id) return order.total;

  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", order.user_id)
    .maybeSingle();
  const role = (data as { role?: string } | null)?.role;
  if (role !== "operator" && role !== "super_admin") return order.total;

  console.warn(
    `[qpay] QPAY_TEST_AMOUNT is active: charging ${test}₮ instead of ${order.total}₮ for a staff order.`,
  );
  return Math.min(test, order.total);
}

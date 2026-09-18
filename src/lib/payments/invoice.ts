import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createInvoice, isQpayMockMode, toDataUrl } from "./qpay";
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
  const row = data as Partial<InvoiceRow> | null;
  // `invoice_id` NULL нь «эзэмшсэн боловч QPay хараахан хариулаагүй» (0086).
  // Тийм мөрийг invoice гэж буцаавал `confirm-order` түүний `amount`-ыг
  // тооцоонд авч, төлбөрийн хуудас хоосон QR зурна.
  if (!row?.invoice_id || !row.qr_text) return null;
  return fromRow(row as InvoiceRow);
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
  // Нууц сегмент нь QPay-д үүсгэсэн invoice дотор л явна — хэрэглэгчийн
  // browser-т хэзээ ч гарахгүй. QPay callback-даа гарын үсэг өгдөггүй тул
  // дуудагчийг таних цорын ганц арга нь энэ (webhook/[secret]/route.ts).
  const path = env.qpayCallbackSecret
    ? `/api/payments/qpay/webhook/${encodeURIComponent(env.qpayCallbackSecret)}`
    : "/api/payments/qpay/webhook";
  return `${origin}${path}?order=${encodeURIComponent(orderNo)}`;
}

/** Эзэмшил хэр удаан «амьд» гэж тооцогдох вэ (QPay-ийн хариу + нөөц). */
const STALE_CLAIM_MS = 60_000;
/** Хожигдсон тал ялагчийг хэр удаан хүлээх вэ. */
const WAIT_STEP_MS = 200;
const WAIT_STEPS = 15;

/**
 * Мөрөө эзэмших оролдлого. `true` = энэ процесс QPay руу залгах эрхтэй.
 *
 * `order_id` primary key дээрх `on conflict do nothing` нь атомар: зэрэг
 * дуудсан хэдэн ч процессоос яг нэг нь мөр оруулна.
 *
 * Хуучирсан эзэмшлийг булаана: QPay руу залгаж байгаад унасан процесс мөрөө
 * дуусгалгүй үлдээвэл захиалга мөнхөд invoice-гүй болно.
 */
async function claim(
  supabase: SupabaseClient,
  orderId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("qpay_invoices")
    .upsert(
      { order_id: orderId, claimed_at: new Date().toISOString() },
      { onConflict: "order_id", ignoreDuplicates: true },
    )
    .select("order_id");
  if ((data as unknown[] | null)?.length) return true;

  // Эзэмшил аль хэдийн байна. Хэт хуучирсан бөгөөд дуусаагүй бол булаана.
  const cutoff = new Date(Date.now() - STALE_CLAIM_MS).toISOString();
  const { data: stolen } = await supabase
    .from("qpay_invoices")
    .update({ claimed_at: new Date().toISOString() })
    .eq("order_id", orderId)
    .is("invoice_id", null)
    .lt("claimed_at", cutoff)
    .select("order_id");
  return Boolean((stolen as unknown[] | null)?.length);
}

/**
 * Ялагчийн бичихийг хүлээнэ. Богино polling — эзэмшигч нь ихэвчлэн нэг QPay
 * дуудлагын зайд (1-2 секунд) дуусдаг. Амжихгүй бол `null`: төлбөрийн хуудас
 * «QPay-тэй холбогдож чадсангүй · Дахин оролдох» гэж харуулна.
 */
async function waitForInvoice(
  supabase: SupabaseClient,
  orderId: string,
): Promise<StoredInvoice | null> {
  for (let i = 0; i < WAIT_STEPS; i += 1) {
    await new Promise((r) => setTimeout(r, WAIT_STEP_MS));
    const row = await readInvoice(supabase, orderId);
    if (row) return row;
  }
  return null;
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

  // Mock invoice нь хадгалагддаггүй тул эзэмшлийн мөр ч хэрэггүй — эзэмшвэл
  // дараа нь бодит invoice үүсэхэд саад болно.
  if (isQpayMockMode()) {
    const mock = await createInvoice({
      orderNo: order.order_no,
      amount,
      callbackUrl: callbackUrlFor(order.order_no),
    });
    return mock
      ? {
          invoiceId: mock.invoiceId,
          qrText: mock.qrText,
          qrImage: mock.qrImage,
          shortUrl: mock.shortUrl,
          deeplinks: mock.deeplinks,
          amount,
        }
      : null;
  }

  // QPay руу залгахаас ӨМНӨ мөрөө эзэмшинэ (0086). `order_id` нь primary key
  // тул зэрэгцээ дуудагчдаас яг нэг нь ялна; хожигдсон нь QPay руу огт
  // залгахгүй, ялагчийн бичихийг хүлээнэ. Ингэснээр нэг захиалгад хоёр бодит
  // invoice үүсэх боломж хаагдана.
  if (!(await claim(supabase, order.id))) {
    return waitForInvoice(supabase, order.id);
  }

  const invoice = await createInvoice({
    orderNo: order.order_no,
    amount,
    callbackUrl: callbackUrlFor(order.order_no),
  });
  if (!invoice) {
    // Эзэмшлээ суллана — эс тэгвээс QPay-ийн түр доголдол энэ захиалгыг
    // `STALE_CLAIM_MS` хүртэл invoice-гүй хорино.
    await supabase.from("qpay_invoices").delete().eq("order_id", order.id);
    return null;
  }

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
  // Эзэмшсэн мөрөө гүйцээнэ. `upsert` биш `update`: мөр аль хэдийн байгаа
  // бөгөөд энэ процесс л түүнийг эзэмшсэн — өөр хэн ч бичихгүй.
  await supabase
    .from("qpay_invoices")
    .update({
      invoice_id: invoice.invoiceId,
      qr_text: invoice.qrText,
      qr_image: toBareBase64(invoice.qrImage),
      short_url: invoice.shortUrl,
      deeplinks: invoice.deeplinks,
      // What the customer is actually asked for, which is not always the
      // order total — see `invoiceAmount`. The payment check compares against
      // this, so it has to be the stored figure.
      amount,
    })
    .eq("order_id", order.id);
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

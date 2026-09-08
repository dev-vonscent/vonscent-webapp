/**
 * QPay V2 merchant API wire types.
 *
 * Ported from the standalone harness in `qpay/` (see `qpay/FINDINGS.md`), where
 * every shape below was checked against the live `merchant.qpay.mn/v2` API with
 * the VONSCENT credentials on 2026-09-07. Anything the harness could not prove
 * with a real payment is called out in a comment — do not tighten those without
 * re-testing (docs/qpay-testing.md).
 */

/** POST /v2/auth/token — Basic auth, no JSON body. */
export interface QpayTokenResponse {
  token_type: string;
  access_token: string;
  /**
   * A unix timestamp in **seconds**, not a TTL — QPay's best-known trap. The
   * observed value 1788800862 is 2026-09-07T17:07:42Z, i.e. ~24h out. Read as a
   * TTL it would put expiry in the year 2083, so a token would never refresh.
   * `expiresAtFromTokenResponse` handles both readings.
   */
  expires_in: number;
  refresh_token: string;
  refresh_expires_in: number;
  scope?: string;
  session_state?: string;
  /** Arrives as the string "0", not a number. */
  "not-before-policy"?: string | number;
}

/** One bank/wallet deeplink QPay returns alongside a created invoice. */
export interface QpayDeeplink {
  name: string;
  description?: string;
  logo?: string;
  link: string;
}

/** POST /v2/invoice — the "simple invoice" shape (no lines/taxes). */
export interface QpayCreateInvoiceRequest {
  invoice_code: string;
  /**
   * The order number. QPay's docs call this unique, but the harness proved it
   * is **not enforced**: two calls with the same value both returned 200 with
   * different `invoice_id`s. Idempotency is ours to keep — see `qpay_invoices`.
   */
  sender_invoice_no: string;
  invoice_receiver_code: string;
  invoice_description: string;
  /** MNT, integer. */
  amount: number;
  /** Must be a public HTTPS URL; QPay rejects localhost. */
  callback_url: string;
}

export interface QpayCreateInvoiceResponse {
  invoice_id: string;
  /** EMVCo QR payload. */
  qr_text: string;
  /** Base64 PNG with **no** `data:` prefix. */
  qr_image: string;
  qPay_shortUrl?: string;
  urls?: QpayDeeplink[];
}

export interface QpayPaymentRow {
  payment_id: string;
  /** "NEW" | "FAILED" | "PAID" | "REFUNDED" — only PAID counts as money in. */
  payment_status: string;
  /** String on the wire ("10.00"). */
  payment_amount: string | number;
  payment_currency?: string;
  payment_date?: string;
  payment_wallet?: string;
  [key: string]: unknown;
}

/** GET /v2/invoice/{invoice_id} */
export interface QpayGetInvoiceResponse {
  invoice_id: string;
  /** "OPEN" while unpaid. The paid value is unconfirmed — see FINDINGS §3. */
  invoice_status: string;
  sender_invoice_no: string;
  /** Mixed types: `total_amount` is a string, `gross_amount` a number. */
  total_amount: string;
  gross_amount: string | number;
  callback_url?: string;
  transactions?: QpayPaymentRow[];
  [key: string]: unknown;
}

/** POST /v2/payment/check */
export interface QpayPaymentCheckResponse {
  count: number;
  /** Omitted entirely when `count` is 0 — never assume it is `0`. */
  paid_amount?: number | string;
  rows?: QpayPaymentRow[];
}

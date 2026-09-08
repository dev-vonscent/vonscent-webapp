/**
 * QPay V2 merchant API wire types.
 *
 * Field names follow the official docs (https://developer.qpay.mn/mn/docs/merchant)
 * cross-checked against the community Go SDK (techpartners-asia/qpay-go).
 * Anything marked "observed" was confirmed against the live API — see FINDINGS.md.
 */

/** POST /v2/auth/token — Basic auth, no JSON body. */
export interface TokenResponse {
  token_type: string;
  access_token: string;
  /**
   * QPay returns a unix timestamp (seconds) here, NOT a duration in seconds.
   * `expiresAtFromTokenResponse` in client.ts handles both shapes defensively.
   */
  expires_in: number;
  refresh_token: string;
  refresh_expires_in: number;
  scope?: string;
  session_state?: string;
  "not-before-policy"?: number;
}

/** One bank/wallet deeplink returned alongside a created invoice. */
export interface InvoiceDeeplink {
  name: string;
  description: string;
  logo: string;
  link: string;
}

/** POST /v2/invoice — the "simple invoice" shape (no lines/taxes). */
export interface CreateInvoiceRequest {
  invoice_code: string;
  /**
   * Merchant-side reference (the order number in production).
   * NOTE: verified against the live API — QPay does NOT reject a repeated value.
   * It happily issues a second invoice_id for the same sender_invoice_no, so
   * idempotency is entirely the merchants job.
   */
  sender_invoice_no: string;
  invoice_receiver_code: string;
  invoice_description: string;
  /** MNT, integer. */
  amount: number;
  /** Must be a public HTTPS URL. */
  callback_url: string;
}

export interface CreateInvoiceResponse {
  invoice_id: string;
  /** EMV QR payload — render this as the QR code. */
  qr_text: string;
  /** Base64 PNG (no data: prefix). */
  qr_image: string;
  qPay_shortUrl?: string;
  urls?: InvoiceDeeplink[];
}

/** GET /v2/invoice/{invoice_id} */
export interface GetInvoiceResponse {
  invoice_id: string;
  /** e.g. "OPEN", "CLOSED", "PAID" — confirm actual values in FINDINGS.md. */
  invoice_status: string;
  sender_invoice_no: string;
  invoice_description: string;
  /** Mixed: total_amount is a string ("10.00"), gross_amount a number (10). */
  gross_amount: string | number;
  total_amount: string;
  discount_amount?: string;
  surcharge_amount?: string;
  tax_amount?: string;
  invoice_due_date?: string | null;
  callback_url?: string;
  transactions?: PaymentRow[];
  [key: string]: unknown;
}

export interface PaginationOffset {
  page_number: number;
  page_limit: number;
}

/** POST /v2/payment/check */
export interface PaymentCheckRequest {
  object_type: "INVOICE" | "QRCODE" | "MERCHANT";
  object_id: string;
  offset: PaginationOffset;
}

export interface PaymentRow {
  payment_id: string;
  /** "NEW" | "FAILED" | "PAID" | "REFUNDED" */
  payment_status: string;
  payment_amount: string;
  payment_currency?: string;
  payment_date?: string;
  payment_fee?: string;
  payment_wallet?: string;
  transaction_type?: string;
  object_type?: string;
  object_id?: string;
  [key: string]: unknown;
}

export interface PaymentCheckResponse {
  count: number;
  /** Omitted entirely when count is 0 — observed on the live API. */
  paid_amount?: number;
  rows: PaymentRow[];
}

/** POST /v2/payment/list */
export interface PaymentListRequest {
  object_type: string;
  object_id: string;
  merchant_branch_code?: string;
  merchant_terminal_code?: string;
  merchant_staff_code?: string;
  start_date?: string;
  end_date?: string;
  offset: PaginationOffset;
}

export type PaymentListResponse = PaymentCheckResponse;

/**
 * What QPay appends to your callback_url when a payment lands.
 * NOTE: this is an unauthenticated ping. Never trust it — always re-verify
 * with POST /v2/payment/check before marking an order paid.
 */
export interface QpayCallbackQuery {
  /** Whatever query params you baked into callback_url yourself. */
  [key: string]: string | undefined;
  payment_id?: string;
  qpay_payment_id?: string;
}

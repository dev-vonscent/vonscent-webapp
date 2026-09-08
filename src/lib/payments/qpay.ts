import "server-only";

import type {
  QpayCreateInvoiceRequest,
  QpayCreateInvoiceResponse,
  QpayDeeplink,
  QpayGetInvoiceResponse,
  QpayPaymentCheckResponse,
  QpayTokenResponse,
} from "./qpay-types";

/**
 * QPay V2 client.
 *
 * Ported from the standalone harness in `qpay/`, which was written against the
 * live merchant API precisely so these four fixes could land here with
 * evidence behind them (`qpay/FINDINGS.md`):
 *
 *   1. the access token is cached, not re-fetched on every single call
 *   2. `expires_in` is a unix timestamp, not a TTL
 *   3. `qr_image` comes back without a `data:` prefix, so it cannot be dropped
 *      straight into an `<img src>` — the old code did exactly that and the QR
 *      was a broken image for every real (non-mock) payment
 *   4. `payment/check` omits `paid_amount` entirely when nothing is paid
 *
 * Testing guide: `docs/qpay-testing.md`.
 *
 * When credentials are missing or `QPAY_MOCK=true`, a local mock invoice is
 * returned so checkout works end to end without merchant credentials.
 */
const QPAY_BASE = (
  process.env.QPAY_BASE_URL?.trim() || "https://merchant.qpay.mn/v2"
).replace(/\/+$/, "");

// ---------------------------------------------------------------------------
// Errors and debug
// ---------------------------------------------------------------------------

export class QpayError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    readonly body: unknown,
  ) {
    super(`QPay ${path} failed with HTTP ${status}: ${stringify(body)}`);
    this.name = "QpayError";
  }
}

function stringify(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** Redacts credentials and the multi-KB QR blob before anything reaches a log. */
function mask(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(mask);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => {
        if (/token|password|secret|authorization/i.test(k)) {
          const s = typeof v === "string" ? v : "";
          return [k, s ? `${s.slice(0, 8)}…<${s.length} chars>` : "<redacted>"];
        }
        if (k === "qr_image" && typeof v === "string") {
          return [k, `<base64 png, ${v.length} chars>`];
        }
        return [k, mask(v)];
      }),
    );
  }
  return value;
}

function debug(label: string, payload: unknown): void {
  if (process.env.DEBUG_QPAY !== "1" && process.env.DEBUG_QPAY !== "true") {
    return;
  }
  console.error(`[qpay] ${label} ${stringify(mask(payload))}`);
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

function isConfigured(): boolean {
  return Boolean(
    process.env.QPAY_USERNAME &&
    process.env.QPAY_PASSWORD &&
    process.env.QPAY_INVOICE_CODE,
  );
}

/** True when invoices are simulated locally instead of calling QPay. */
export function isQpayMockMode(): boolean {
  if (process.env.QPAY_MOCK === "true") return true;
  return !isConfigured();
}

// ---------------------------------------------------------------------------
// Token cache
// ---------------------------------------------------------------------------

interface CachedToken {
  accessToken: string;
  /** Epoch milliseconds after which we refuse to reuse the token. */
  expiresAtMs: number;
}

/** Refresh this far before the real expiry so an in-flight call can't race it. */
const EXPIRY_SKEW_MS = 60_000;

/** Above this, `expires_in` is a unix timestamp in seconds. ~1970-04-26. */
const TIMESTAMP_THRESHOLD_SECONDS = 10_000_000;

let cached: CachedToken | null = null;
/** Deduplicates concurrent fetches so we never open two auth calls at once. */
let inFlight: Promise<CachedToken> | null = null;

/**
 * QPay's `expires_in` is a unix timestamp in seconds, not a TTL. Both readings
 * are handled so a server-side change at QPay cannot silently produce a token
 * we treat as permanently valid (or already expired).
 */
export function expiresAtFromTokenResponse(
  res: Pick<QpayTokenResponse, "expires_in">,
  nowMs = Date.now(),
): number {
  const raw = Number(res.expires_in);
  // No usable hint — assume a conservative 10 minutes.
  if (!Number.isFinite(raw) || raw <= 0) return nowMs + 10 * 60_000;
  return raw > TIMESTAMP_THRESHOLD_SECONDS ? raw * 1000 : nowMs + raw * 1000;
}

async function fetchToken(): Promise<CachedToken> {
  const basic = Buffer.from(
    `${process.env.QPAY_USERNAME}:${process.env.QPAY_PASSWORD}`,
  ).toString("base64");
  const path = "/auth/token";
  debug("POST", { path, auth: "Basic <redacted>" });

  const res = await fetch(`${QPAY_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/json",
    },
  });

  const body = await readBody(res);
  debug(`POST ${path} -> ${res.status}`, body);
  if (!res.ok) throw new QpayError(res.status, path, body);

  const token = body as QpayTokenResponse;
  if (!token?.access_token) throw new QpayError(res.status, path, body);

  return {
    accessToken: token.access_token,
    expiresAtMs: expiresAtFromTokenResponse(token),
  };
}

/** Drops the cached token. Tests use this to isolate cases. */
export function clearQpayTokenCache(): void {
  cached = null;
  inFlight = null;
}

async function getToken(): Promise<string> {
  const now = Date.now();
  if (cached && cached.expiresAtMs - EXPIRY_SKEW_MS > now) {
    return cached.accessToken;
  }
  if (!inFlight) {
    inFlight = fetchToken().finally(() => {
      inFlight = null;
    });
  }
  // A failed fetch must not poison the cache — `inFlight` rejects and the next
  // caller starts a fresh attempt.
  cached = await inFlight;
  return cached.accessToken;
}

// ---------------------------------------------------------------------------
// Request helper
// ---------------------------------------------------------------------------

async function readBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function request<T>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  const accessToken = await getToken();
  debug(method, { path, body });

  const res = await fetch(`${QPAY_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  const payload = await readBody(res);
  debug(`${method} ${path} -> ${res.status}`, payload);
  if (!res.ok) throw new QpayError(res.status, path, payload);
  return payload as T;
}

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

/** A created invoice, normalised for the payment page. */
export interface QpayInvoice {
  invoiceId: string;
  qrText: string;
  /**
   * Ready for `<img src>` — the `data:image/png;base64,` prefix is added here
   * because QPay returns bare base64 (FINDINGS §2). Null when QPay sent none.
   */
  qrImage: string | null;
  /** `qPay_shortUrl` — a plain https link, handy in email and SMS. */
  shortUrl: string | null;
  /** Bank and wallet apps that can pay this invoice. */
  deeplinks: QpayDeeplink[];
  /** True for a locally simulated invoice (no credentials / QPAY_MOCK). */
  mock?: boolean;
}

function mockQrDataUrl(orderNo: string, amount: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220" viewBox="0 0 220 220">
    <rect width="220" height="220" fill="#fff"/>
    <rect x="8" y="8" width="204" height="204" fill="none" stroke="#111" stroke-width="4"/>
    <rect x="24" y="24" width="44" height="44" fill="#111"/>
    <rect x="152" y="24" width="44" height="44" fill="#111"/>
    <rect x="24" y="152" width="44" height="44" fill="#111"/>
    <text x="110" y="104" text-anchor="middle" font-family="monospace" font-size="12" fill="#111">MOCK QPAY</text>
    <text x="110" y="122" text-anchor="middle" font-family="monospace" font-size="11" fill="#444">${orderNo}</text>
    <text x="110" y="139" text-anchor="middle" font-family="monospace" font-size="11" fill="#444">${amount}₮</text>
  </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function createMockInvoice(orderNo: string, amount: number): QpayInvoice {
  return {
    invoiceId: `MOCK-${orderNo}-${Date.now()}`,
    qrText: `QPAY:MOCK:${orderNo}:${amount}`,
    qrImage: mockQrDataUrl(orderNo, amount),
    shortUrl: null,
    deeplinks: [],
    mock: true,
  };
}

/**
 * Create a QPay invoice for an order.
 *
 * Returns null when QPay could not be reached or refused the request — the
 * caller decides what to show. It never throws: an order has already been
 * placed by this point and a QPay outage must not lose it.
 */
export async function createInvoice(params: {
  orderNo: string;
  amount: number;
  callbackUrl: string;
  description?: string;
}): Promise<QpayInvoice | null> {
  if (isQpayMockMode()) {
    return createMockInvoice(params.orderNo, params.amount);
  }

  const payload: QpayCreateInvoiceRequest = {
    invoice_code: process.env.QPAY_INVOICE_CODE!,
    sender_invoice_no: params.orderNo,
    invoice_receiver_code: "terminal",
    invoice_description: params.description ?? `vonscent ${params.orderNo}`,
    amount: params.amount,
    callback_url: params.callbackUrl,
  };

  try {
    const data = await request<QpayCreateInvoiceResponse>(
      "POST",
      "/invoice",
      payload,
    );
    if (!data?.invoice_id) return null;
    return {
      invoiceId: data.invoice_id,
      qrText: data.qr_text ?? "",
      qrImage: toDataUrl(data.qr_image),
      shortUrl: data.qPay_shortUrl ?? null,
      deeplinks: (data.urls ?? []).filter((u) => u?.link && u?.name),
    };
  } catch (e) {
    debug("createInvoice failed", { message: (e as Error).message });
    return null;
  }
}

/**
 * QPay's `qr_image` is bare base64. A value that already carries a prefix is
 * passed through so a mock (or a future QPay change) still renders.
 */
export function toDataUrl(base64: string | null | undefined): string | null {
  const value = base64?.trim();
  if (!value) return null;
  if (value.startsWith("data:")) return value;
  return `data:image/png;base64,${value}`;
}

/** Read an invoice back. Note: QPay does not return `qr_image`/`urls` here. */
export async function getInvoice(
  invoiceId: string,
): Promise<QpayGetInvoiceResponse | null> {
  if (isQpayMockMode()) return null;
  try {
    return await request<QpayGetInvoiceResponse>(
      "GET",
      `/invoice/${encodeURIComponent(invoiceId)}`,
    );
  } catch {
    return null;
  }
}

/** Cancel an unpaid invoice. QPay answers 200 with an empty body. */
export async function cancelInvoice(invoiceId: string): Promise<boolean> {
  if (isQpayMockMode()) return false;
  try {
    await request<unknown>(
      "DELETE",
      `/invoice/${encodeURIComponent(invoiceId)}`,
    );
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Payment verification
// ---------------------------------------------------------------------------

export interface QpayPaymentCheck {
  paid: boolean;
  /** Sum of PAID rows, in ₮. */
  paidAmount: number;
}

/**
 * The authoritative "was this actually paid?" call.
 *
 * The callback is an unauthenticated ping — anyone who learns an order number
 * can hit it — so an order is only ever marked paid after this confirms the
 * money. Returns null when the check itself could not be performed (mock mode,
 * auth or network failure); callers must treat null as "not verified", never as
 * "not paid", or a QPay outage would silently reject real payments.
 */
export async function checkPayment(
  invoiceId: string,
): Promise<QpayPaymentCheck | null> {
  if (isQpayMockMode()) return null;

  let data: QpayPaymentCheckResponse;
  try {
    data = await request<QpayPaymentCheckResponse>("POST", "/payment/check", {
      object_type: "INVOICE",
      object_id: invoiceId,
      offset: { page_number: 1, page_limit: 100 },
    });
  } catch {
    return null;
  }

  // Only PAID rows are money in — a REFUNDED row carries a positive amount too.
  const rowSum = (data.rows ?? [])
    .filter((r) => r.payment_status === "PAID")
    .reduce((sum, r) => sum + Number(r.payment_amount ?? 0), 0);
  // `paid_amount` is absent (not 0) on an unpaid invoice, hence the `?? 0`.
  const paidAmount = rowSum > 0 ? rowSum : Number(data.paid_amount ?? 0);

  return { paid: paidAmount > 0, paidAmount };
}

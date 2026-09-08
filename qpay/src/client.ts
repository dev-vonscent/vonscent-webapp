import { config } from "./config.js";
import type {
  CreateInvoiceRequest,
  CreateInvoiceResponse,
  GetInvoiceResponse,
  PaymentCheckRequest,
  PaymentCheckResponse,
  PaymentListRequest,
  PaymentListResponse,
  PaymentRow,
  TokenResponse,
} from "./types.js";

/**
 * QPay V2 client.
 *
 * Deliberately different from vonscent/src/lib/payments/qpay.ts in four ways —
 * these are the fixes to port back once this harness proves the API shape:
 *   1. the access token is cached instead of re-fetched on every call
 *   2. failures throw QpayError with status + body instead of returning null
 *   3. payment/check and invoice GET exist at all
 *   4. every request/response can be dumped with DEBUG_QPAY=1
 */

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

/** Redacts anything that looks like a credential before it reaches a log. */
function mask(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(mask);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => {
        if (/token|password|secret|authorization/i.test(k)) {
          const s = typeof v === "string" ? v : "";
          return [k, s ? `${s.slice(0, 8)}…<${s.length} chars>` : "<redacted>"];
        }
        // qr_image is a multi-KB base64 blob; never dump it inline.
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
  if (!config.debug) return;
  console.error(`\x1b[90m[qpay] ${label} ${stringify(mask(payload))}\x1b[0m`);
}

// ---------------------------------------------------------------------------
// Token cache
// ---------------------------------------------------------------------------

interface CachedToken {
  accessToken: string;
  /** Epoch milliseconds after which we refuse to reuse the token. */
  expiresAtMs: number;
}

/** Refresh this many ms before the real expiry so an in-flight call can't race it. */
const EXPIRY_SKEW_MS = 60_000;

/** Values above this are unix timestamps (seconds), not durations. ~1970-04-26. */
const TIMESTAMP_THRESHOLD_SECONDS = 10_000_000;

let cached: CachedToken | null = null;
/** Deduplicates concurrent token fetches so we never open two auth calls at once. */
let inFlight: Promise<CachedToken> | null = null;

/**
 * QPay's `expires_in` is a unix timestamp in seconds, not a TTL — a documented
 * quirk that trips up every fresh integration. Handle both interpretations so a
 * server-side change can't silently produce a token we treat as already-expired.
 */
export function expiresAtFromTokenResponse(
  res: TokenResponse,
  nowMs = Date.now(),
): number {
  const raw = Number(res.expires_in);
  if (!Number.isFinite(raw) || raw <= 0) {
    // No usable hint — assume a conservative 10 minutes.
    return nowMs + 10 * 60_000;
  }
  return raw > TIMESTAMP_THRESHOLD_SECONDS ? raw * 1000 : nowMs + raw * 1000;
}

async function fetchToken(): Promise<CachedToken> {
  const basic = Buffer.from(`${config.username}:${config.password}`).toString(
    "base64",
  );
  const path = "/auth/token";
  debug("POST", { path, auth: "Basic <redacted>" });

  const res = await fetch(`${config.baseUrl}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/json",
    },
  });

  const body = await readBody(res);
  debug(`POST ${path} -> ${res.status}`, body);
  if (!res.ok) throw new QpayError(res.status, path, body);

  const token = body as TokenResponse;
  if (!token.access_token) throw new QpayError(res.status, path, body);

  lastTokenResponse = token;
  return {
    accessToken: token.access_token,
    expiresAtMs: expiresAtFromTokenResponse(token),
  };
}

/** The raw token payload from the most recent auth call — for the 01-token script. */
export let lastTokenResponse: TokenResponse | null = null;

export interface TokenInfo {
  accessToken: string;
  expiresAtMs: number;
  /** True when this call was served from cache without touching the network. */
  fromCache: boolean;
}

/** Returns a valid access token, reusing the cached one whenever possible. */
export async function getToken(): Promise<TokenInfo> {
  const now = Date.now();
  if (cached && cached.expiresAtMs - EXPIRY_SKEW_MS > now) {
    return { ...cached, fromCache: true };
  }
  if (!inFlight) {
    inFlight = fetchToken().finally(() => {
      inFlight = null;
    });
  }
  cached = await inFlight;
  return { ...cached, fromCache: false };
}

/** Drops the cached token. Used by the token script to prove caching works. */
export function clearTokenCache(): void {
  cached = null;
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
  const { accessToken } = await getToken();
  debug(`${method}`, { path, body });

  const res = await fetch(`${config.baseUrl}${path}`, {
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
// Endpoints
// ---------------------------------------------------------------------------

export interface CreateInvoiceParams {
  /** Merchant-side reference (the order number). QPay does not enforce uniqueness. */
  senderInvoiceNo: string;
  amount: number;
  description: string;
  callbackUrl?: string;
  /** Free-form customer identifier QPay echoes back. */
  receiverCode?: string;
}

export async function createInvoice(
  params: CreateInvoiceParams,
): Promise<CreateInvoiceResponse> {
  const payload: CreateInvoiceRequest = {
    invoice_code: config.invoiceCode,
    sender_invoice_no: params.senderInvoiceNo,
    invoice_receiver_code: params.receiverCode ?? "terminal",
    invoice_description: params.description,
    amount: params.amount,
    callback_url: params.callbackUrl ?? config.callbackUrl,
  };
  return request<CreateInvoiceResponse>("POST", "/invoice", payload);
}

export function getInvoice(invoiceId: string): Promise<GetInvoiceResponse> {
  return request<GetInvoiceResponse>(
    "GET",
    `/invoice/${encodeURIComponent(invoiceId)}`,
  );
}

export function cancelInvoice(invoiceId: string): Promise<unknown> {
  return request<unknown>(
    "DELETE",
    `/invoice/${encodeURIComponent(invoiceId)}`,
  );
}

/**
 * The authoritative "was this actually paid?" call. Run it after every callback
 * and compare `paid_amount` against the order total server-side.
 */
export function checkPayment(
  invoiceId: string,
  page = 1,
  limit = 100,
): Promise<PaymentCheckResponse> {
  const payload: PaymentCheckRequest = {
    object_type: "INVOICE",
    object_id: invoiceId,
    offset: { page_number: page, page_limit: limit },
  };
  return request<PaymentCheckResponse>("POST", "/payment/check", payload);
}

export function getPayment(paymentId: string): Promise<PaymentRow> {
  return request<PaymentRow>(
    "GET",
    `/payment/${encodeURIComponent(paymentId)}`,
  );
}

export function listPayments(
  payload: PaymentListRequest,
): Promise<PaymentListResponse> {
  return request<PaymentListResponse>("POST", "/payment/list", payload);
}

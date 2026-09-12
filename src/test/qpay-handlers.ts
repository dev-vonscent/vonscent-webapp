import { http, HttpResponse, type JsonBodyType } from "msw";

/**
 * Reusable msw handlers for the QPay merchant API.
 *
 * The default set answers a happy path (token + empty payment list + invoice
 * creation); individual tests override endpoints with `server.use(...)`.
 *
 * Response shapes mirror the live API as recorded in `qpay/FINDINGS.md` —
 * notably `expires_in` as a unix timestamp and `qr_image` as bare base64 with
 * no `data:` prefix. Handlers that lie about those would let a regression pass.
 */

export const QPAY_BASE = "https://merchant.qpay.mn/v2";

/**
 * `expires_in` — QPay яг ингэж явуулдаг: TTL биш, **unix timestamp** (секунд).
 *
 * Тогтмол тоо байсныг **одооноос нэг цагийн дараа** гэж болгов. Хатуу
 * бичсэн `1788887262` нь 2026-09-08-д хүрч, тэр өдрөөс эхлэн token нь
 * «хугацаа нь дууссан» гэж уншигдаж, кэш ажиллахаа болсон — «authenticates
 * once across several calls» тест өдөр ирэх тусам өөрөө унадаг болсон юм.
 * Тест нь `expires_in` ба `expiresAtMs`-ийн ХӨРВҮҮЛЭЛТИЙГ шалгах ёстой болохоос
 * хуанлийн тодорхой өдрөөс хамаарах учиргүй.
 */
export const QPAY_EXPIRES_TIMESTAMP = Math.floor(Date.now() / 1000) + 3600;

export const qpayToken = (
  token = "tok_1",
  expiresIn: number = QPAY_EXPIRES_TIMESTAMP,
) =>
  http.post(`${QPAY_BASE}/auth/token`, () =>
    HttpResponse.json({
      token_type: "bearer",
      access_token: token,
      expires_in: expiresIn,
      refresh_token: "refresh_1",
      refresh_expires_in: expiresIn,
      scope: "get_token",
      "not-before-policy": "0",
    }),
  );

export const qpayTokenFailure = (status = 401) =>
  http.post(
    `${QPAY_BASE}/auth/token`,
    () => new HttpResponse(null, { status }),
  );

/** Counts how many times the token endpoint is hit — proves the cache works. */
export function qpayTokenCounter(token = "tok_1") {
  const state = { calls: 0 };
  const handler = http.post(`${QPAY_BASE}/auth/token`, () => {
    state.calls += 1;
    return HttpResponse.json({
      token_type: "bearer",
      access_token: token,
      expires_in: QPAY_EXPIRES_TIMESTAMP,
      refresh_token: "refresh_1",
      refresh_expires_in: QPAY_EXPIRES_TIMESTAMP,
    });
  });
  return { handler, state };
}

export const qpayPaymentCheck = (body: JsonBodyType) =>
  http.post(`${QPAY_BASE}/payment/check`, () => HttpResponse.json(body));

export const qpayPaymentCheckFailure = (status = 500) =>
  http.post(
    `${QPAY_BASE}/payment/check`,
    () => new HttpResponse(null, { status }),
  );

export const qpayCreateInvoice = (body: JsonBodyType) =>
  http.post(`${QPAY_BASE}/invoice`, () => HttpResponse.json(body));

export const qpayCreateInvoiceFailure = (status = 400) =>
  http.post(`${QPAY_BASE}/invoice`, () => new HttpResponse(null, { status }));

export const qpayGetInvoice = (body: JsonBodyType) =>
  http.get(`${QPAY_BASE}/invoice/:id`, () => HttpResponse.json(body));

export const qpayCancelInvoice = (status = 200) =>
  http.delete(`${QPAY_BASE}/invoice/:id`, () =>
    status === 200 ? HttpResponse.json({}) : new HttpResponse(null, { status }),
  );

/** `count: 0` with **no** `paid_amount` key — the real unpaid response. */
export const defaultQpayHandlers = [
  qpayToken(),
  qpayPaymentCheck({ count: 0, rows: [] }),
  qpayCreateInvoice({
    invoice_id: "inv_1",
    qr_text: "QR",
    qr_image: "AAAA",
  }),
];

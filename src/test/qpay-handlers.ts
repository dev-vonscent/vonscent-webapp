import { http, HttpResponse, type JsonBodyType } from "msw";

/**
 * Reusable msw handlers for the QPay merchant API. The default set answers a
 * happy path (token + empty payment list + invoice creation); individual
 * tests override endpoints with `server.use(...)`.
 */

export const QPAY_BASE = "https://merchant.qpay.mn/v2";

export const qpayToken = (token = "tok_1") =>
  http.post(`${QPAY_BASE}/auth/token`, () =>
    HttpResponse.json({ access_token: token }),
  );

export const qpayTokenFailure = (status = 401) =>
  http.post(`${QPAY_BASE}/auth/token`, () => new HttpResponse(null, { status }));

export const qpayPaymentCheck = (body: JsonBodyType) =>
  http.post(`${QPAY_BASE}/payment/check`, () => HttpResponse.json(body));

export const qpayPaymentCheckFailure = (status = 500) =>
  http.post(
    `${QPAY_BASE}/payment/check`,
    () => new HttpResponse(null, { status }),
  );

export const qpayCreateInvoice = (body: JsonBodyType) =>
  http.post(`${QPAY_BASE}/invoice`, () => HttpResponse.json(body));

export const defaultQpayHandlers = [
  qpayToken(),
  qpayPaymentCheck({ rows: [], paid_amount: 0 }),
  qpayCreateInvoice({ invoice_id: "inv_1", qr_text: "QR" }),
];

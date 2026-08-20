import "server-only";

/**
 * QPay integration (development.md §1, §9.4). When credentials are missing or
 * QPAY_MOCK=true, a local mock invoice is returned so checkout can be tested end
 * to end without merchant credentials.
 */
const QPAY_BASE = "https://merchant.qpay.mn/v2";

export interface QpayInvoice {
  invoiceId: string;
  qrText: string;
  qrImage: string | null;
  mock?: boolean;
}

function isConfigured() {
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

function mockQrDataUrl(orderNo: string, amount: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
    <rect width="200" height="200" fill="#fff"/>
    <rect x="8" y="8" width="184" height="184" fill="none" stroke="#111" stroke-width="4"/>
    <rect x="20" y="20" width="40" height="40" fill="#111"/>
    <rect x="140" y="20" width="40" height="40" fill="#111"/>
    <rect x="20" y="140" width="40" height="40" fill="#111"/>
    <text x="100" y="95" text-anchor="middle" font-family="monospace" font-size="11" fill="#111">MOCK QPAY</text>
    <text x="100" y="112" text-anchor="middle" font-family="monospace" font-size="10" fill="#444">${orderNo}</text>
    <text x="100" y="128" text-anchor="middle" font-family="monospace" font-size="10" fill="#444">${amount}₮</text>
  </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function createMockInvoice(params: {
  orderNo: string;
  amount: number;
}): QpayInvoice {
  const invoiceId = `MOCK-${params.orderNo}-${Date.now()}`;
  const qrText = `QPAY:MOCK:${params.orderNo}:${params.amount}`;
  return {
    invoiceId,
    qrText,
    qrImage: mockQrDataUrl(params.orderNo, params.amount),
    mock: true,
  };
}

async function getToken(): Promise<string | null> {
  if (!isConfigured()) return null;
  const auth = Buffer.from(
    `${process.env.QPAY_USERNAME}:${process.env.QPAY_PASSWORD}`,
  ).toString("base64");
  const res = await fetch(`${QPAY_BASE}/auth/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { access_token?: string };
  return data.access_token ?? null;
}

/** Create a QPay invoice for an order. Uses mock data when QPay isn't configured. */
export async function createInvoice(params: {
  orderNo: string;
  amount: number;
  callbackUrl: string;
}): Promise<QpayInvoice | null> {
  if (isQpayMockMode()) return createMockInvoice(params);

  const token = await getToken();
  if (!token) return null;

  const res = await fetch(`${QPAY_BASE}/invoice`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      invoice_code: process.env.QPAY_INVOICE_CODE,
      sender_invoice_no: params.orderNo,
      invoice_receiver_code: "terminal",
      invoice_description: `vonscent ${params.orderNo}`,
      amount: params.amount,
      callback_url: params.callbackUrl,
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    invoice_id: string;
    qr_text: string;
    qr_image?: string;
  };
  return {
    invoiceId: data.invoice_id,
    qrText: data.qr_text,
    qrImage: data.qr_image ?? null,
  };
}

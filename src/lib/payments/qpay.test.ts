import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
} from "vitest";
import { setupServer } from "msw/node";
import {
  defaultQpayHandlers,
  qpayCreateInvoice,
  qpayPaymentCheck,
  qpayPaymentCheckFailure,
  qpayTokenFailure,
} from "@/test/qpay-handlers";
import { checkPayment, createInvoice, isQpayMockMode } from "./qpay";

/** Real HTTP layer, mocked at the network edge (msw) instead of stubbing fetch. */
const server = setupServer(...defaultQpayHandlers);

const CREDS = {
  QPAY_USERNAME: "merchant",
  QPAY_PASSWORD: "secret",
  QPAY_INVOICE_CODE: "VONSCENT_INVOICE",
};

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

beforeEach(() => {
  for (const [key, value] of Object.entries(CREDS)) {
    vi.stubEnv(key, value);
  }
  vi.stubEnv("QPAY_MOCK", "");
});

afterEach(() => {
  server.resetHandlers();
  vi.unstubAllEnvs();
});

describe("checkPayment", () => {
  it("refuses to check in mock mode (missing credentials)", async () => {
    vi.stubEnv("QPAY_USERNAME", "");
    expect(isQpayMockMode()).toBe(true);
    expect(await checkPayment("inv_1")).toBeNull();
  });

  it("refuses to check when QPAY_MOCK=true even with credentials", async () => {
    vi.stubEnv("QPAY_MOCK", "true");
    expect(await checkPayment("inv_1")).toBeNull();
  });

  it("sums only PAID rows", async () => {
    server.use(
      qpayPaymentCheck({
        rows: [
          { payment_status: "PAID", payment_amount: "50000" },
          { payment_status: "PAID", payment_amount: 30000 },
          { payment_status: "REFUNDED", payment_amount: 99999 },
        ],
      }),
    );

    expect(await checkPayment("inv_1")).toEqual({
      paid: true,
      paidAmount: 80000,
    });
  });

  it("falls back to paid_amount when rows are absent", async () => {
    server.use(qpayPaymentCheck({ paid_amount: 120000 }));

    expect(await checkPayment("inv_1")).toEqual({
      paid: true,
      paidAmount: 120000,
    });
  });

  it("reports unpaid invoices as not paid", async () => {
    expect(await checkPayment("inv_1")).toEqual({ paid: false, paidAmount: 0 });
  });

  it("returns null (not verified) when the token request fails", async () => {
    server.use(qpayTokenFailure());
    expect(await checkPayment("inv_1")).toBeNull();
  });

  it("returns null (not verified) when the check request fails", async () => {
    server.use(qpayPaymentCheckFailure());
    expect(await checkPayment("inv_1")).toBeNull();
  });
});

describe("createInvoice", () => {
  const PARAMS = {
    orderNo: "VS-1001",
    amount: 45000,
    callbackUrl: "https://vonscent.mn/api/payments/callback",
  };

  it("returns a local mock invoice in mock mode without touching QPay", async () => {
    vi.stubEnv("QPAY_MOCK", "true");
    const invoice = await createInvoice(PARAMS);
    expect(invoice?.mock).toBe(true);
    expect(invoice?.qrText).toContain("VS-1001");
  });

  it("creates a real invoice through the API", async () => {
    server.use(
      qpayCreateInvoice({
        invoice_id: "inv_42",
        qr_text: "QPAY:INV42",
        qr_image: "data:image/png;base64,AAA",
      }),
    );

    expect(await createInvoice(PARAMS)).toEqual({
      invoiceId: "inv_42",
      qrText: "QPAY:INV42",
      qrImage: "data:image/png;base64,AAA",
    });
  });

  it("returns null when authentication fails", async () => {
    server.use(qpayTokenFailure());
    expect(await createInvoice(PARAMS)).toBeNull();
  });
});

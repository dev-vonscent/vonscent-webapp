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
  QPAY_EXPIRES_TIMESTAMP,
  defaultQpayHandlers,
  qpayCancelInvoice,
  qpayCreateInvoice,
  qpayCreateInvoiceFailure,
  qpayGetInvoice,
  qpayPaymentCheck,
  qpayPaymentCheckFailure,
  qpayToken,
  qpayTokenCounter,
  qpayTokenFailure,
} from "@/test/qpay-handlers";
import {
  cancelInvoice,
  checkPayment,
  clearQpayTokenCache,
  createInvoice,
  expiresAtFromTokenResponse,
  getInvoice,
  isQpayMockMode,
  toDataUrl,
} from "./qpay";

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
  // The token cache is module state — it would leak across cases otherwise.
  clearQpayTokenCache();
});

afterEach(() => {
  server.resetHandlers();
  vi.unstubAllEnvs();
});

describe("expiresAtFromTokenResponse", () => {
  const NOW = 1_788_800_000_000;

  it("reads QPay's expires_in as a unix timestamp, not a TTL", () => {
    // The trap: as a TTL this would land in the year 2083 and the token would
    // never refresh.
    expect(
      expiresAtFromTokenResponse({ expires_in: QPAY_EXPIRES_TIMESTAMP }, NOW),
    ).toBe(QPAY_EXPIRES_TIMESTAMP * 1000);
  });

  it("still treats a small value as a duration", () => {
    expect(expiresAtFromTokenResponse({ expires_in: 3600 }, NOW)).toBe(
      NOW + 3_600_000,
    );
  });

  it("falls back to ten minutes when the hint is unusable", () => {
    expect(expiresAtFromTokenResponse({ expires_in: 0 }, NOW)).toBe(
      NOW + 600_000,
    );
    expect(expiresAtFromTokenResponse({ expires_in: NaN }, NOW)).toBe(
      NOW + 600_000,
    );
  });
});

describe("toDataUrl", () => {
  it("adds the prefix QPay omits", () => {
    expect(toDataUrl("AAAA")).toBe("data:image/png;base64,AAAA");
  });

  it("leaves an already-prefixed value alone", () => {
    expect(toDataUrl("data:image/svg+xml;base64,BBBB")).toBe(
      "data:image/svg+xml;base64,BBBB",
    );
  });

  it("maps empty input to null", () => {
    expect(toDataUrl(null)).toBeNull();
    expect(toDataUrl("  ")).toBeNull();
  });
});

describe("token caching", () => {
  it("authenticates once across several calls", async () => {
    const { handler, state } = qpayTokenCounter();
    server.use(handler);

    await checkPayment("inv_1");
    await checkPayment("inv_2");
    await checkPayment("inv_3");

    expect(state.calls).toBe(1);
  });

  it("does not cache a failed authentication", async () => {
    server.use(qpayTokenFailure());
    expect(await checkPayment("inv_1")).toBeNull();

    const { handler, state } = qpayTokenCounter();
    server.use(handler);
    await checkPayment("inv_1");
    expect(state.calls).toBe(1);
  });

  it("re-authenticates once the cached token has expired", async () => {
    // A short TTL is read as a duration, so this token is already stale by the
    // time the 60s refresh skew is applied.
    server.use(qpayToken("tok_short", 30));
    await checkPayment("inv_1");

    const { handler, state } = qpayTokenCounter();
    server.use(handler);
    await checkPayment("inv_2");
    expect(state.calls).toBe(1);
  });
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
        count: 3,
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
    server.use(qpayPaymentCheck({ count: 1, paid_amount: 120000 }));

    expect(await checkPayment("inv_1")).toEqual({
      paid: true,
      paidAmount: 120000,
    });
  });

  it("reports an unpaid invoice as not paid when paid_amount is missing", async () => {
    // The live API omits paid_amount entirely at count: 0 — the `?? 0` guard.
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
    callbackUrl: "https://vonscent.mn/api/payments/qpay/webhook",
  };

  it("returns a local mock invoice in mock mode without touching QPay", async () => {
    vi.stubEnv("QPAY_MOCK", "true");
    const invoice = await createInvoice(PARAMS);
    expect(invoice?.mock).toBe(true);
    expect(invoice?.qrText).toContain("VS-1001");
    expect(invoice?.qrImage).toMatch(/^data:image\/svg\+xml;base64,/);
  });

  it("normalises a real invoice, prefixing the bare base64 QR", async () => {
    server.use(
      qpayCreateInvoice({
        invoice_id: "inv_42",
        qr_text: "00020101021215312794…",
        qr_image: "iVBORw0KGgo",
        qPay_shortUrl: "https://s.qpay.mn/zNr4bs145B",
        urls: [
          { name: "Khan bank", link: "khanbank://q?qPay_QRcode=x", logo: "l" },
          { name: "no link", link: "" },
        ],
      }),
    );

    expect(await createInvoice(PARAMS)).toEqual({
      invoiceId: "inv_42",
      qrText: "00020101021215312794…",
      qrImage: "data:image/png;base64,iVBORw0KGgo",
      shortUrl: "https://s.qpay.mn/zNr4bs145B",
      deeplinks: [
        { name: "Khan bank", link: "khanbank://q?qPay_QRcode=x", logo: "l" },
      ],
    });
  });

  it("returns null when authentication fails", async () => {
    server.use(qpayTokenFailure());
    expect(await createInvoice(PARAMS)).toBeNull();
  });

  it("returns null (never throws) when QPay rejects the invoice", async () => {
    // An order has already been placed by this point; a QPay error must not
    // bubble out and lose it.
    server.use(qpayCreateInvoiceFailure());
    expect(await createInvoice(PARAMS)).toBeNull();
  });
});

describe("getInvoice / cancelInvoice", () => {
  it("reads an invoice back", async () => {
    server.use(qpayGetInvoice({ invoice_id: "inv_1", invoice_status: "OPEN" }));
    const invoice = await getInvoice("inv_1");
    expect(invoice?.invoice_status).toBe("OPEN");
  });

  it("cancels an invoice on an empty 200 body", async () => {
    server.use(qpayCancelInvoice());
    expect(await cancelInvoice("inv_1")).toBe(true);
  });

  it("reports a failed cancel rather than throwing", async () => {
    server.use(qpayCancelInvoice(404));
    expect(await cancelInvoice("inv_1")).toBe(false);
  });

  it("does nothing in mock mode", async () => {
    vi.stubEnv("QPAY_MOCK", "true");
    expect(await getInvoice("inv_1")).toBeNull();
    expect(await cancelInvoice("inv_1")).toBe(false);
  });
});

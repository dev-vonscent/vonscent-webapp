import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { checkPayment, isQpayMockMode } from "./qpay";

type MockResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

const json = (status: number, body: unknown = {}): MockResponse => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

const CREDS = {
  QPAY_USERNAME: "merchant",
  QPAY_PASSWORD: "secret",
  QPAY_INVOICE_CODE: "VONSCENT_INVOICE",
};

const tokenResponse = json(200, { access_token: "tok_1" });

describe("checkPayment", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    for (const [key, value] of Object.entries(CREDS)) {
      vi.stubEnv(key, value);
    }
    vi.stubEnv("QPAY_MOCK", "");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("refuses to check in mock mode (missing credentials)", async () => {
    vi.stubEnv("QPAY_USERNAME", "");
    expect(isQpayMockMode()).toBe(true);
    expect(await checkPayment("inv_1")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("refuses to check when QPAY_MOCK=true even with credentials", async () => {
    vi.stubEnv("QPAY_MOCK", "true");
    expect(await checkPayment("inv_1")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sums only PAID rows", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(tokenResponse as unknown as Response)
      .mockResolvedValueOnce(
        json(200, {
          rows: [
            { payment_status: "PAID", payment_amount: "50000" },
            { payment_status: "PAID", payment_amount: 30000 },
            { payment_status: "REFUNDED", payment_amount: 99999 },
          ],
        }) as unknown as Response,
      );

    expect(await checkPayment("inv_1")).toEqual({
      paid: true,
      paidAmount: 80000,
    });
  });

  it("falls back to paid_amount when rows are absent", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(tokenResponse as unknown as Response)
      .mockResolvedValueOnce(
        json(200, { paid_amount: 120000 }) as unknown as Response,
      );

    expect(await checkPayment("inv_1")).toEqual({
      paid: true,
      paidAmount: 120000,
    });
  });

  it("reports unpaid invoices as not paid", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(tokenResponse as unknown as Response)
      .mockResolvedValueOnce(
        json(200, { rows: [], paid_amount: 0 }) as unknown as Response,
      );

    expect(await checkPayment("inv_1")).toEqual({ paid: false, paidAmount: 0 });
  });

  it("returns null (not verified) when the token request fails", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(json(401) as unknown as Response);
    expect(await checkPayment("inv_1")).toBeNull();
  });

  it("returns null (not verified) when the check request fails", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(tokenResponse as unknown as Response)
      .mockResolvedValueOnce(json(500) as unknown as Response);
    expect(await checkPayment("inv_1")).toBeNull();
  });
});

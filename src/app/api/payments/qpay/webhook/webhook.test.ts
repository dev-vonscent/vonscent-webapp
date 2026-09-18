import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * QPay callback-ийн хаалга.
 *
 * QPay нь callback-даа гарын үсэг өгдөггүй (V2 баримтад HMAC/signature/IP
 * allowlist байхгүй; онбординг захидал нь «хүлээн авсны дараа шалгаж
 * баталгаажуулна уу» гэж заадаг). Хуурамч хүсэлтээр захиалгыг «төлөгдсөн»
 * болгох боломжгүй — handler нь ирсэн өгөгдлийг уншдаггүй, QPay-ээс дахин
 * асуудаг — ГЭХДЭЭ нууцгүй бол endpoint нь тандалтын оракул ба QPay-ийн
 * квот шатаагч болно. Эдгээр тест яг түүнээс хамгаална.
 */

const verifyAndMarkOrderPaidByOrderNo = vi.fn();
let secret = "";
let mockMode = false;

vi.mock("@/lib/env", () => ({
  env: {
    get qpayCallbackSecret() {
      return secret;
    },
    siteUrl: "https://vonscent.mn",
  },
}));
vi.mock("@/lib/payments/qpay", () => ({ isQpayMockMode: () => mockMode }));
vi.mock("@/lib/payments/confirm-order", () => ({
  verifyAndMarkOrderPaidByOrderNo,
}));
vi.mock("@/lib/rate-limit", () => ({ enforceRateLimit: async () => null }));

const secured = await import("./[secret]/route");
const legacy = await import("./route");

const url = (path: string) => `https://vonscent.mn${path}?order=VS-1042`;

beforeEach(() => {
  verifyAndMarkOrderPaidByOrderNo.mockReset();
  verifyAndMarkOrderPaidByOrderNo.mockResolvedValue({ ok: true });
  secret = "s3cret";
  mockMode = false;
});

describe("secured callback path", () => {
  const call = (given: string) =>
    secured.GET(new Request(url(`/api/payments/qpay/webhook/${given}`)), {
      params: Promise.resolve({ secret: given }),
    });

  it("confirms the order for the right secret", async () => {
    const res = await call("s3cret");
    expect(res.status).toBe(200);
    expect(verifyAndMarkOrderPaidByOrderNo).toHaveBeenCalledWith("VS-1042");
  });

  it("404s a wrong secret without ever asking QPay", async () => {
    const res = await call("wrong!");
    expect(res.status).toBe(404);
    expect(verifyAndMarkOrderPaidByOrderNo).not.toHaveBeenCalled();
  });

  it("404s a secret of a different length without throwing", async () => {
    // `timingSafeEqual` шидэлт хийдэг тул уртыг эхлээд шалгах ёстой.
    expect((await call("short")).status).toBe(404);
  });

  it("answers 404, not 401/403 — a different code would confirm the path exists", async () => {
    const res = await call("wrong!");
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it("refuses everything when no secret is configured", async () => {
    secret = "";
    expect((await call("anything")).status).toBe(404);
    expect(verifyAndMarkOrderPaidByOrderNo).not.toHaveBeenCalled();
  });
});

describe("legacy unsecured path", () => {
  const call = () => legacy.GET(new Request(url("/api/payments/qpay/webhook")));

  it("closes once a secret is configured — new invoices use the secured path", async () => {
    const res = await call();
    expect(res.status).toBe(404);
    expect(verifyAndMarkOrderPaidByOrderNo).not.toHaveBeenCalled();
  });

  it("still works while no secret is set, so one forgotten env cannot drop every payment", async () => {
    secret = "";
    const res = await call();
    expect(res.status).toBe(200);
    expect(verifyAndMarkOrderPaidByOrderNo).toHaveBeenCalledWith("VS-1042");
  });
});

describe("retry semantics", () => {
  const call = () =>
    secured.GET(new Request(url("/api/payments/qpay/webhook/s3cret")), {
      params: Promise.resolve({ secret: "s3cret" }),
    });

  it("maps a QPay outage to 5xx so QPay retries rather than giving up on real money", async () => {
    verifyAndMarkOrderPaidByOrderNo.mockResolvedValue({
      ok: false,
      error: "CHECK_FAILED",
    });
    expect((await call()).status).toBe(502);
  });

  it("maps an unpaid invoice to a terminal 4xx", async () => {
    verifyAndMarkOrderPaidByOrderNo.mockResolvedValue({
      ok: false,
      error: "NOT_PAID",
    });
    expect((await call()).status).toBe(402);
  });

  it("maps a cancelled order to a terminal 409 — retrying can never succeed", async () => {
    verifyAndMarkOrderPaidByOrderNo.mockResolvedValue({
      ok: false,
      error: "ORDER_CANCELLED",
    });
    expect((await call()).status).toBe(409);
  });

  it("stays disabled in mock mode", async () => {
    mockMode = true;
    expect((await call()).status).toBe(403);
  });
});

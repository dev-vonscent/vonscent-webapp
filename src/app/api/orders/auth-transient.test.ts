import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthRetryableFetchError } from "@supabase/supabase-js";

/**
 * Auth түр унахад (сүлжээ, 5xx) нэвтэрсэн хэрэглэгчийн захиалга чимээгүй
 * зочных болж V point нь алга болдог байв. Одоо дахин оролдоод, бүгд
 * бүтэлгүйтвэл 503 буцаана — зочин гэж үзэхгүй.
 */

const getUser = vi.fn();
const rpc = vi.fn();

vi.mock("@/lib/rate-limit", () => ({ enforceRateLimit: async () => null }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser } }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => null }));
vi.mock("@/lib/supabase/rpc", () => ({ callRpc: rpc }));
vi.mock("@/features/checkout/api", () => {
  class E extends Error {}
  return {
    computeSummary: async () => ({
      lines: [
        { productId: "p", variantId: "v", ml: 5, qty: 1, unitPrice: 30000 },
      ],
      subtotal: 30000,
      shippingFee: 0,
      shipZone: "ub",
    }),
    BundleUnavailableError: E,
    InsufficientStockError: E,
    ItemsUnavailableError: E,
    UndeliverableZoneError: E,
  };
});

const { POST } = await import("./route");

function post(extra: Record<string, unknown> = {}) {
  return new Request("http://test/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contactName: "Хэрэглэгч",
      contactPhone: "99112233",
      shipCity: "Улаанбаатар",
      shipDistrict: "Сүхбаатар",
      shipDetail: "1-р хороо, 5-р байр",
      shipKhoroo: 1,
      shipZone: "ub",
      paymentMethod: "qpay",
      items: [{ productId: "p", variantId: "v", ml: 5, qty: 1 }],
      ...extra,
    }),
  });
}

const transient = () => ({
  data: { user: null },
  error: new AuthRetryableFetchError("Failed to fetch", 0),
});

beforeEach(() => {
  getUser.mockReset();
  rpc.mockReset();
});

describe("POST /api/orders — auth transient errors", () => {
  it("answers 503 instead of placing a guest order when auth stays down", async () => {
    getUser.mockResolvedValue(transient());
    const res = await POST(post());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "AUTH_UNAVAILABLE" });
    expect(getUser).toHaveBeenCalledTimes(3);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("recovers the signed-in user after a transient failure", async () => {
    getUser
      .mockResolvedValueOnce(transient())
      .mockResolvedValueOnce({ data: { user: { id: "u1" } }, error: null });
    // A coupon needs a signed-in user; reaching past LOGIN_REQUIRED proves
    // the retry found them.
    const res = await POST(post({ couponCode: "WELCOME11" }));
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(503);
    expect(getUser).toHaveBeenCalledTimes(2);
  });
});

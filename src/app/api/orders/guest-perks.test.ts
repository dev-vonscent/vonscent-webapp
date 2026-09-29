import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Зочин купон, V point ашиглаж захиалга үүсгэх гэвэл route тод татгалзана
 * (0104). place_order ч мөн үл хэрэгсдэг, гэхдээ чимээгүй хаявал хэрэглэгч
 * хүлээж байсан хөнгөлөлтгүйгээр төлнө.
 */

let user: { id: string } | null = null;
const rpc = vi.fn();

vi.mock("@/lib/rate-limit", () => ({ enforceRateLimit: async () => null }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user } }) },
  }),
}));
// No DB: the route stops before any write, so none is needed — and if it did
// not stop, `rpc` would record the order it tried to place.
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
    mlByProduct: () => new Map(),
    priceGiftLines: async () => [],
    BundleUnavailableError: E,
    InsufficientStockError: E,
    ItemsUnavailableError: E,
    UndeliverableZoneError: E,
  };
});

const { POST } = await import("./route");

const BODY = {
  contactName: "Зочин",
  contactPhone: "99112233",
  shipCity: "Улаанбаатар",
  shipDistrict: "Сүхбаатар",
  shipDetail: "1-р хороо, 5-р байр",
  shipKhoroo: 1,
  shipZone: "ub",
  paymentMethod: "qpay",
  items: [{ productId: "p", variantId: "v", ml: 5, qty: 1 }],
};

function post(extra: Record<string, unknown>) {
  return new Request("http://test/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...BODY, ...extra }),
  });
}

beforeEach(() => {
  user = null;
  rpc.mockReset();
});

describe("POST /api/orders — guest perks", () => {
  it("refuses a guest's coupon", async () => {
    const res = await POST(post({ couponCode: "WELCOME11" }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "LOGIN_REQUIRED" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("refuses a guest's V point", async () => {
    const res = await POST(post({ loyaltyUsed: 5000 }));
    expect(res.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("lets a guest order without either", async () => {
    const res = await POST(post({}));
    // Past validation and the gate (no DB here, so it ends in demo mode).
    expect(res.status).toBe(200);
  });

  it("does not stop a signed-in customer's coupon at the gate", async () => {
    user = { id: "u1" };
    const res = await POST(post({ couponCode: "VS-ABCDEF" }));
    expect(res.status).toBe(200);
  });
});

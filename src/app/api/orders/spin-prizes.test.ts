import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Азын хүрдний бодит шагнал (0165/0170): бүртгэлтэй хэрэглэгчийн сонгосон
 * шагналууд `place_order_with_prizes`-ээр захиалгатай НЭГ transaction-д
 * хавсарна; зочны илгээсэн id-г үл тоомсорлож энгийн `place_order` дуудна.
 * Шагнал авах боломжгүй бол 409 `PRIZE_UNAVAILABLE`.
 */

let user: { id: string } | null = { id: "u1" };
const rpc = vi.fn();

vi.mock("@/lib/rate-limit", () => ({ enforceRateLimit: async () => null }));
vi.mock("@/lib/cache", () => ({ revalidatePublic: () => {} }));
vi.mock("@/features/content/api", () => ({
  getShippingSettings: async () => ({ zones: [] }),
}));
vi.mock("@/lib/geo/zone", () => ({ isRemoteAddress: () => false }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user } }) },
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/supabase/rpc", () => ({
  callRpc: (...args: unknown[]) => rpc(...args),
}));
vi.mock("@/lib/orders/idempotency", () => ({
  claimOrderRequest: async () => ({ won: true }),
  completeOrderRequest: async () => {},
  releaseOrderRequest: async () => {},
}));
vi.mock("@/lib/payments/invoice", () => ({ ensureInvoice: async () => null }));
vi.mock("@/lib/notify/customer-email", () => ({
  sendOrderCustomerEmail: async () => {},
}));
vi.mock("@/features/checkout/api", () => {
  class E extends Error {}
  return {
    computeSummary: async () => ({
      lines: [
        { productId: "p", variantId: "v1", ml: 5, qty: 1, unitPrice: 30000 },
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

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

function order(extra: Record<string, unknown>) {
  return POST(
    new Request("http://test/api/orders", {
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
        items: [{ productId: "p", variantId: "v1", ml: 5, qty: 1 }],
        ...extra,
      }),
    }),
  );
}

beforeEach(() => {
  user = { id: "u1" };
  // Stop right after the RPC: the refusal path is enough to see the call.
  rpc.mockReset().mockResolvedValue({
    data: null,
    error: { message: "PRIZE_UNAVAILABLE" },
  });
});

describe("POST /api/orders — хүрдний шагнал", () => {
  it("хэд хэдэн шагналыг нэг дуудлагаар, давхардалгүй хавсаргана", async () => {
    const res = await order({ prizeSpinIds: [A, B], prizeSpinId: A });
    expect(rpc).toHaveBeenCalledWith(
      expect.anything(),
      "place_order_with_prizes",
      expect.objectContaining({ p_spins: [A, B] }),
    );
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "PRIZE_UNAVAILABLE" });
  });

  it("шагналгүй бол энгийн place_order", async () => {
    await order({});
    expect(rpc.mock.calls[0][1]).toBe("place_order");
    expect(rpc.mock.calls[0][2]).not.toHaveProperty("p_spins");
  });

  it("зочны илгээсэн шагналыг үл тоомсорлоно", async () => {
    user = null;
    await order({ prizeSpinIds: [A] });
    expect(rpc.mock.calls[0][1]).toBe("place_order");
  });
});

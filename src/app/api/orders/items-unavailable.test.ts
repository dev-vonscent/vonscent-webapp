import { describe, expect, it, vi } from "vitest";

/**
 * place_order-ийн мөрийн шалгалт (0125/0126): computeSummary шалгасны дараа
 * бараа «Тун удахгүй» болсон, эсвэл бэлгийн мөр буруу хэмжээтэй бол
 * `ITEMS_UNAVAILABLE:<variant_id>` шиднэ. Route үүнийг computeSummary-ийн
 * ItemsUnavailableError-тай ижил 409 болгоно — клиент мөрийг хасна.
 */

let rpcError: { message: string } | null = null;

vi.mock("@/lib/rate-limit", () => ({ enforceRateLimit: async () => null }));
vi.mock("@/lib/cache", () => ({ revalidatePublic: () => {} }));
vi.mock("@/features/content/api", () => ({
  getShippingSettings: async () => ({ zones: [] }),
}));
vi.mock("@/lib/geo/zone", () => ({ isRemoteAddress: () => false }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: null } }) },
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/supabase/rpc", () => ({
  callRpc: async () => ({ data: null, error: rpcError }),
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

function order() {
  return POST(
    new Request("http://test/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contactName: "Зочин",
        contactPhone: "99112233",
        shipCity: "Улаанбаатар",
        shipDistrict: "Сүхбаатар",
        shipDetail: "1-р хороо, 5-р байр",
        shipKhoroo: 1,
        shipZone: "ub",
        paymentMethod: "qpay",
        items: [{ productId: "p", variantId: "v1", ml: 5, qty: 1 }],
      }),
    }),
  );
}

describe("POST /api/orders — place_order ITEMS_UNAVAILABLE", () => {
  it("хэмжээтэй мөр → 409, тэр variant-ийг нэрлэнэ", async () => {
    rpcError = { message: "ITEMS_UNAVAILABLE:v1" };
    const res = await order();
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: "ITEMS_UNAVAILABLE",
      variantIds: ["v1"],
    });
  });

  it("бэлгийн мөр (variant-гүй) → 409, хоосон жагсаалт", async () => {
    rpcError = { message: "ITEMS_UNAVAILABLE:" };
    const res = await order();
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: "ITEMS_UNAVAILABLE",
      variantIds: [],
    });
  });
});

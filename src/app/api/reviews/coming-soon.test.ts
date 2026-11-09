import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * «Тун удахгүй» (0125) ус хэнд ч хүрээгүй — түүнд сэтгэгдэл бичвэл үнэлгээг
 * нь хуурамчаар хөөргөнө. Route нь худалдаанд байгаа (`is_active`) усанд л
 * зөвшөөрнө; DB trigger `is_active`-ийг `status = 'active'`-тай тэнцүүлдэг.
 */

const PRODUCT = "5b1f2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
let product: { id: string; is_active: boolean } | null = null;
const upsert = vi.fn();

vi.mock("@/lib/env", () => ({ isSupabaseConfigured: true }));
vi.mock("@/lib/rate-limit", () => ({ enforceRateLimit: async () => null }));
vi.mock("@/lib/cache", () => ({
  revalidateProductReviews: () => {},
  revalidateCollectionReviews: () => {},
  revalidatePublic: () => {},
}));
vi.mock("@/lib/feature-flags", () => ({ isFeatureEnabled: async () => false }));
vi.mock("@/lib/auth/guard", () => ({ getStaffUser: async () => null }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => null }));
vi.mock("@/features/reviews/server", () => ({
  revalidateTarget: async () => {},
}));
vi.mock("@/features/reviews/api", () => ({
  getReviewById: async () => null,
  getReviewPage: async () => ({ reviews: [] }),
}));

/** `.select().eq(..).eq("is_active", true).maybeSingle()` — шүүлтийг дагана. */
function productsQuery() {
  const filters: Record<string, unknown> = {};
  const chain = {
    select: () => chain,
    eq: (col: string, value: unknown) => {
      filters[col] = value;
      return chain;
    },
    maybeSingle: async () => ({
      data:
        product &&
        filters.id === product.id &&
        (filters.is_active === undefined ||
          filters.is_active === product.is_active)
          ? { id: product.id }
          : null,
    }),
  };
  return chain;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    from: (table: string) =>
      table === "reviews"
        ? {
            upsert: (row: unknown) => {
              upsert(row);
              const chain = {
                select: () => chain,
                single: async () => ({ data: { id: "r1" }, error: null }),
                maybeSingle: async () => ({ data: { id: "r1" }, error: null }),
              };
              return chain;
            },
          }
        : productsQuery(),
  }),
}));

const { POST } = await import("./route");

function review() {
  return POST(
    new Request("http://test/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: PRODUCT, rating: 5, body: "Гоё" }),
    }),
  );
}

beforeEach(() => {
  upsert.mockReset();
});

describe("POST /api/reviews — «Тун удахгүй» ус", () => {
  it("худалдаанд гараагүй ус 404, сэтгэгдэл бичигдэхгүй", async () => {
    // coming_soon → trigger нь is_active=false болгоно.
    product = { id: PRODUCT, is_active: false };
    const res = await review();
    expect(res.status).toBe(404);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("худалдаанд байгаа усанд бичнэ", async () => {
    product = { id: PRODUCT, is_active: true };
    await review();
    expect(upsert).toHaveBeenCalledOnce();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Барааны ерөнхий засвар (PATCH) нь «Тун удахгүй» барааг худалдаанд гаргах
 * арын хаалга болохгүй (0125): гаргах цорын ганц зам нь launch endpoint.
 * Мөн хэмжээний үнэ бичигдээгүй бол «хадгалагдлаа» гэж худал хэлэхгүй.
 */

/** Сан дээрх барааны одоогийн төлөв — нөхцөлтэй UPDATE үүнийг харна. */
let currentStatus: "hidden" | "coming_soon" | "active" = "active";
let productError: { message: string } | null = null;
let variantError: { message: string } | null = null;
/** Мөр огт байхгүй (буруу id). */
let missing = false;
const productUpdates: Record<string, unknown>[] = [];
const variantUpserts: unknown[] = [];

vi.mock("@/lib/env", () => ({ isSupabaseConfigured: true }));
vi.mock("@/lib/cache", () => ({ revalidatePublic: () => {} }));
vi.mock("@/lib/auth/guard", () => ({
  getStaffUser: async () => ({ id: "staff", role: "operator" }),
}));
vi.mock("@/features/taxonomy/api", () => ({
  resolveBrandId: async () => null,
  resolveConcentration: async (c: string) => c,
  sanitizeCustomTags: async (t: string[]) => t,
  sanitizeFamilies: async (f: string[]) => f,
}));

/** `products.update().eq().neq?().select()` — `neq`-ийг сан шиг шүүнэ. */
function productsTable() {
  return {
    update(row: Record<string, unknown>) {
      productUpdates.push(row);
      let excluded: string | null = null;
      const chain = {
        eq: () => chain,
        neq: (_col: string, value: string) => {
          excluded = value;
          return chain;
        },
        select: async () =>
          productError
            ? { data: null, error: productError }
            : {
                data:
                  missing || currentStatus === excluded ? [] : [{ id: "p1" }],
                error: null,
              },
      };
      return chain;
    },
  };
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "products") return productsTable();
      if (table === "product_variants") {
        return {
          upsert: async (row: unknown) => {
            variantUpserts.push(row);
            return { error: variantError };
          },
        };
      }
      // inventory
      return { update: () => ({ eq: async () => ({ error: null }) }) };
    },
  }),
}));

const { PATCH } = await import("./route");

function patch(body: unknown) {
  return PATCH(
    new Request("http://test/api/admin/products/p1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: "p1" }) },
  );
}

const VARIANTS = [
  { ml: 5, price: 30000, salePrice: null, active: true },
  { ml: 10, price: 55000, salePrice: null, active: true },
];

beforeEach(() => {
  currentStatus = "active";
  productError = null;
  variantError = null;
  missing = false;
  productUpdates.length = 0;
  variantUpserts.length = 0;
});

describe("PATCH /api/admin/products/[id] — төлөв", () => {
  it("«Тун удахгүй» → «Идэвхтэй» нь 409 LAUNCH_REQUIRED, үнэ бичигдэхгүй", async () => {
    currentStatus = "coming_soon";
    const res = await patch({ status: "active", variants: VARIANTS });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.code).toBe("LAUNCH_REQUIRED");
    expect(json.error).toContain("Худалдаанд гаргах");
    expect(variantUpserts).toHaveLength(0);
  });

  it("нуусан барааг «Идэвхтэй» болгох нь хэвийн", async () => {
    currentStatus = "hidden";
    const res = await patch({ status: "active" });
    expect(res.status).toBe(200);
    expect(productUpdates[0]).toMatchObject({ status: "active" });
  });

  it("гарсан барааг «Тун удахгүй» болгох нь DB-ийн ALREADY_LAUNCHED → 409", async () => {
    productError = {
      message: 'ALREADY_LAUNCHED (SQLSTATE P0001) in "products_status_sync"',
    };
    const res = await patch({ status: "coming_soon" });
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("ALREADY_LAUNCHED");
  });

  it("«Тун удахгүй» бараан дээр төлөв илгээлгүй засах нь хэвийн", async () => {
    currentStatus = "coming_soon";
    const res = await patch({ name: "Шинэ нэр", comingSoonNote: "10-р сар" });
    expect(res.status).toBe(200);
  });

  it("байхгүй бараа 404", async () => {
    missing = true;
    const res = await patch({ status: "hidden" });
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/admin/products/[id] — хэмжээний үнэ", () => {
  it("upsert бүтэлгүйтвэл 500 + аль хэмжээ гэдгийг хэлнэ", async () => {
    variantError = { message: "boom" };
    const res = await patch({ variants: VARIANTS });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: "VARIANT_UPDATE_FAILED",
      ml: 5,
    });
    // Эхний алдаан дээр зогсоно — дараагийнхыг бичихгүй.
    expect(variantUpserts).toHaveLength(1);
  });

  it("бүх upsert амжилттай бол ok", async () => {
    const res = await patch({ variants: VARIANTS });
    expect(res.status).toBe(200);
    expect(variantUpserts).toHaveLength(2);
  });
});

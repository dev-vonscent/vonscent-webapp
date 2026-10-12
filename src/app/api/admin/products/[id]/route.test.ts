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
/** Харагдах зургийн тоо (`hasVisibleImage`). */
let imageCount = 1;
/** `inventory.update().select()`-ийн үр дүн. */
let inventoryRows: unknown[] = [{ product_id: "p1" }];
let inventoryError: { message: string } | null = null;
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
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({
          data: missing ? null : { id: "p1", status: currentStatus },
          error: null,
        }),
      }),
    }),
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
      if (table === "product_images") {
        return {
          select: () => ({
            eq: () => ({
              eq: async () => ({ count: imageCount, error: null }),
            }),
          }),
        };
      }
      if (table === "inventory") {
        return {
          update: () => ({
            eq: () => ({
              select: async () => ({
                data: inventoryError ? null : inventoryRows,
                error: inventoryError,
              }),
            }),
          }),
        };
      }
      // custom tags
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
  imageCount = 1;
  inventoryRows = [{ product_id: "p1" }];
  inventoryError = null;
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

  it("байхгүй бараанд «Идэвхтэй» илгээвэл 409 биш 404", async () => {
    missing = true;
    const res = await patch({ status: "active" });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("NOT_FOUND");
    expect(productUpdates).toHaveLength(0);
  });

  it("байхгүй бараанд зөвхөн хэмжээ илгээвэл 500 биш 404", async () => {
    missing = true;
    const res = await patch({ variants: VARIANTS });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("NOT_FOUND");
    expect(variantUpserts).toHaveLength(0);
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

describe("PATCH /api/admin/products/[id] — зураггүй нийтлэх", () => {
  it("нуусан, зураггүй барааг «Идэвхтэй» болгохгүй — 409 NO_IMAGE", async () => {
    currentStatus = "hidden";
    imageCount = 0;
    const res = await patch({ status: "active" });
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("NO_IMAGE");
    expect(productUpdates).toHaveLength(0);
  });

  it("зураггүй барааг «Тун удахгүй» болгохгүй", async () => {
    currentStatus = "hidden";
    imageCount = 0;
    const res = await patch({ status: "coming_soon" });
    expect(res.status).toBe(409);
  });

  it("аль хэдийн идэвхтэй, зураггүй барааны засварыг түгжихгүй", async () => {
    currentStatus = "active";
    imageCount = 0;
    const res = await patch({ status: "active", name: "Шинэ нэр" });
    expect(res.status).toBe(200);
  });

  it("зураггүй барааг нуух нь хэвийн", async () => {
    currentStatus = "active";
    imageCount = 0;
    const res = await patch({ status: "hidden" });
    expect(res.status).toBe(200);
  });
});

describe("PATCH /api/admin/products/[id] — бага үлдэгдлийн босго", () => {
  it("алдааг залгихгүй — 500, үнэ хадгалагдсан хэвээр", async () => {
    inventoryError = { message: "boom" };
    const res = await patch({ variants: VARIANTS, lowStockMl: 30 });
    expect(res.status).toBe(500);
    expect((await res.json()).code).toBe("LOW_STOCK_UPDATE_FAILED");
    expect(variantUpserts).toHaveLength(2);
  });

  it("inventory мөр байхгүй (0 мөр) бол 500", async () => {
    inventoryRows = [];
    const res = await patch({ lowStockMl: 30 });
    expect(res.status).toBe(500);
  });

  it("амжилттай бол ok", async () => {
    const res = await patch({ lowStockMl: 30 });
    expect(res.status).toBe(200);
  });
});

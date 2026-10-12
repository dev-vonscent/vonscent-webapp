import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Шинэ бараа үүсгэх (POST): DB бичилт аль нэг нь бүтэлгүйтвэл бараа устаж,
 * гаж нөлөөтэй алхам (төлбөртэй AI зураг, Storage руу савны зураг хуулах)
 * огт эхлээгүй байх ёстой. Устгал өөрөө бүтэлгүйтвэл админд id-г хэлнэ.
 */

const runNewProductImages = vi.fn();
const addBottleImage = vi.fn();
/** `after()`-д бүртгэгдсэн callback — дуудагдсан эсэхийг л шалгана. */
const afterCallbacks: (() => unknown)[] = [];

let tagLinkError: { message: string } | null = null;
let deleteError: { message: string } | null = null;
const deletedIds: string[] = [];
/** Харагдах зургийн тоо (`hasVisibleImage`) — нийтлэх эсэхийг шийднэ. */
let imageCount = 1;
const statusUpdates: unknown[] = [];

vi.mock("next/server", async (orig) => ({
  ...(await orig<typeof import("next/server")>()),
  after: (cb: () => unknown) => afterCallbacks.push(cb),
}));
vi.mock("@/lib/env", () => ({
  isSupabaseConfigured: true,
  isImageGenConfigured: true,
}));
vi.mock("@/lib/cache", () => ({ revalidatePublic: () => {} }));
vi.mock("@/lib/auth/guard", () => ({
  getStaffUser: async () => ({ id: "staff", role: "operator" }),
}));
vi.mock("@/lib/storage/storage", () => ({ isStorageUrl: () => true }));
vi.mock("@/features/taxonomy/api", () => ({
  resolveBrandId: async () => null,
  resolveConcentration: async (c: string) => c,
  sanitizeCustomTags: async (t: string[]) => t,
  sanitizeFamilies: async (f: string[]) => f,
}));
vi.mock("@/lib/ai/new-product-pipeline", () => ({ runNewProductImages }));
vi.mock("@/features/admin/bottle-image", () => ({ addBottleImage }));

const ok = { error: null };

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "products") {
        return {
          insert: () => ({
            select: () => ({
              single: async () => ({ data: { id: "p1" }, error: null }),
            }),
          }),
          update: (row: unknown) => {
            statusUpdates.push(row);
            return { eq: async () => ok };
          },
          delete: () => ({
            eq: async (_col: string, id: string) => {
              deletedIds.push(id);
              return { error: deleteError };
            },
          }),
        };
      }
      if (table === "custom_tags") {
        return {
          select: () => ({
            in: async () => ({ data: [{ id: "t1", slug: "x" }], error: null }),
          }),
        };
      }
      if (table === "product_custom_tags") {
        return { insert: async () => ({ error: tagLinkError }) };
      }
      if (table === "product_images") {
        return {
          insert: async () => ok,
          select: () => ({
            eq: () => ({
              eq: async () => ({ count: imageCount, error: null }),
            }),
          }),
        };
      }
      // product_variants, inventory
      return { insert: async () => ok };
    },
  }),
}));

const { POST } = await import("./route");

const BASE = {
  name: "Test",
  brand: "Brand",
  gender: "unisex",
  concentration: "edp",
  onHandMl: 100,
  lowStockMl: 10,
  bottlePrice: 300000,
  variants: [{ ml: 5, price: 30000, active: true }],
  customTags: ["x"],
  bottleStyle: "black",
};

function create(body: Record<string, unknown>) {
  return POST(
    new Request("http://test/api/admin/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...BASE, ...body }),
    }),
  );
}

const AI = {
  referenceUrl: "https://storage.test/ref.png",
  generateImage: true,
};

beforeEach(() => {
  runNewProductImages.mockReset();
  addBottleImage.mockReset();
  afterCallbacks.length = 0;
  tagLinkError = null;
  deleteError = null;
  deletedIds.length = 0;
  imageCount = 1;
  statusUpdates.length = 0;
});

describe("POST /api/admin/products — tags бүтэлгүйтвэл", () => {
  it("AI горимд pipeline бүртгэгдэхгүй, бараа устана", async () => {
    tagLinkError = { message: "boom" };
    const res = await create(AI);
    expect(res.status).toBe(500);
    expect(afterCallbacks).toHaveLength(0);
    expect(runNewProductImages).not.toHaveBeenCalled();
    expect(addBottleImage).not.toHaveBeenCalled();
    expect(deletedIds).toEqual(["p1"]);
  });

  it("гар горимд савны зураг хуулагдахгүй, бараа устана", async () => {
    tagLinkError = { message: "boom" };
    const res = await create({});
    expect(res.status).toBe(500);
    expect(addBottleImage).not.toHaveBeenCalled();
    expect(deletedIds).toEqual(["p1"]);
  });

  it("устгал бүтэлгүйтвэл id-тай CLEANUP_FAILED буцаана", async () => {
    tagLinkError = { message: "boom" };
    deleteError = { message: "fk" };
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await create({});
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({
      code: "CLEANUP_FAILED",
      id: "p1",
    });
    expect(err).toHaveBeenCalledWith(
      "product create cleanup failed",
      expect.objectContaining({ productId: "p1" }),
    );
    err.mockRestore();
  });
});

describe("POST /api/admin/products — амжилттай", () => {
  it("AI горимд pipeline бүртгэгдэнэ", async () => {
    const res = await create(AI);
    expect(res.status).toBe(200);
    expect(afterCallbacks).toHaveLength(1);
    expect(deletedIds).toHaveLength(0);
  });

  it("гар горимд савны зураг нэмэгдэнэ", async () => {
    const res = await create({});
    expect(res.status).toBe(200);
    expect(addBottleImage).toHaveBeenCalledWith(
      expect.anything(),
      "p1",
      expect.any(String),
      "black",
      "end",
    );
  });
});

describe("POST /api/admin/products — зураггүй бол нийтлэхгүй", () => {
  it("харагдах зураггүй бол нуусан хэвээр үлдэнэ", async () => {
    imageCount = 0;
    const res = await create({ status: "active" });
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("hidden");
    expect(statusUpdates).toHaveLength(0);
  });

  it("зурагтай бол хүссэн төлөвөөр нийтлэгдэнэ", async () => {
    const res = await create({ status: "active" });
    expect((await res.json()).status).toBe("active");
    expect(statusUpdates).toEqual([{ status: "active" }]);
  });
});

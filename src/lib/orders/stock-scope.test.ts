import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const flags = new Set<string>();
vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: async (k: string) => flags.has(k),
}));
const { stockScopeForOrder } = await import("./stock-scope");

type Result = { data: unknown; error: unknown };

/** `from(table)` → `.select().eq()` / `.select().in()` нь хүснэгтийн хариуг буцаана. */
function client(tables: Record<string, Result>, seen: string[] = []) {
  return {
    from(table: string) {
      seen.push(table);
      const res = tables[table] ?? { data: [], error: null };
      const chain = {
        select: () => chain,
        eq: async () => res,
        in: async () => res,
      };
      return chain;
    },
  } as never;
}

describe("stockScopeForOrder", () => {
  it("барааны slug + захиалсан багц + усыг агуулсан багцууд", async () => {
    const scope = await stockScopeForOrder(
      client({
        order_items: {
          data: [
            // Багцын мөрүүд гишүүн ус бүрээр.
            {
              product_id: "p1",
              products: { slug: "a" },
              collections: { slug: "set-1" },
            },
            {
              product_id: "p2",
              products: { slug: "b" },
              collections: [{ slug: "set-1" }],
            },
            { product_id: "p1", products: { slug: "a" }, collections: null },
            // Устгагдсан бараа — slug алга.
            { product_id: null, products: null, collections: null },
          ],
          error: null,
        },
        collection_items: {
          data: [{ collections: { slug: "set-2" } }, { collections: null }],
          error: null,
        },
      }),
      "o1",
    );
    expect(scope).toEqual({
      productSlugs: ["a", "b"],
      collectionSlugs: ["set-1", "set-2"],
      extraSlugs: [],
    });
  });

  it("бараагүй бол багцын гишүүнчлэлийг асуухгүй", async () => {
    const seen: string[] = [];
    const scope = await stockScopeForOrder(
      client({ order_items: { data: [], error: null } }, seen),
      "o1",
    );
    expect(scope).toEqual({
      productSlugs: [],
      collectionSlugs: [],
      extraSlugs: [],
    });
    expect(seen).toEqual(["order_items"]);
  });

  it("алдаа гарвал undefined — дуудагч өргөн хүрээ рүү унана", async () => {
    expect(
      await stockScopeForOrder(
        client({ order_items: { data: null, error: { message: "x" } } }),
        "o1",
      ),
    ).toBeUndefined();
    expect(
      await stockScopeForOrder(
        client({
          order_items: {
            data: [
              { product_id: "p1", products: { slug: "a" }, collections: null },
            ],
            error: null,
          },
          collection_items: { data: null, error: { message: "x" } },
        }),
        "o1",
      ),
    ).toBeUndefined();
    const throwing = {
      from() {
        throw new Error("boom");
      },
    } as never;
    expect(await stockScopeForOrder(throwing, "o1")).toBeUndefined();
  });
});

describe("stockScopeForOrder — нэмэлт бараа, сав", () => {
  const extraLine = {
    product_id: null,
    products: null,
    collections: null,
    extra_product_id: "e1",
    vial_id: null,
    qty: 1,
  };
  const perfumeLine = {
    product_id: "p1",
    products: { slug: "a" },
    collections: null,
    extra_product_id: null,
    vial_id: "v5",
    qty: 2,
  };

  it("нэмэлт барааны slug ба түүний холбоотой үнэртэн", async () => {
    const scope = await stockScopeForOrder(
      client({
        order_items: { data: [extraLine], error: null },
        extra_products: {
          data: [
            { slug: "leftover-aventus", products: { slug: "creed-aventus" } },
          ],
          error: null,
        },
      }),
      "o1",
    );
    expect(scope).toEqual({
      productSlugs: ["creed-aventus"],
      collectionSlugs: [],
      extraSlugs: ["leftover-aventus"],
    });
  });

  it("vial_inventory хаалттай бол савыг асуухгүй", async () => {
    const seen: string[] = [];
    const scope = await stockScopeForOrder(
      client({ order_items: { data: [perfumeLine], error: null } }, seen),
      "o1",
    );
    expect(seen).not.toContain("vials");
    expect(scope?.productSlugs).toEqual(["a"]);
  });

  it("сав хил дээр (үлдэгдэл ≤ энэ захиалгын тоо) → undefined (өргөн хүрээ)", async () => {
    flags.add("vial_inventory");
    try {
      const vials = (onHand: number | null, reserved: number) => ({
        order_items: { data: [perfumeLine], error: null },
        vials: {
          data: [{ id: "v5", on_hand: onHand, reserved, is_active: true }],
          error: null,
        },
      });
      // Энэ захиалгаар дууссан (үлдэгдэл 0) эсвэл цуцлалтаар 0 → 2 нээгдсэн.
      expect(
        await stockScopeForOrder(client(vials(10, 10)), "o1"),
      ).toBeUndefined();
      expect(
        await stockScopeForOrder(client(vials(10, 8)), "o1"),
      ).toBeUndefined();
      // Хилээс хол — нарийн хүрээ.
      expect(
        (await stockScopeForOrder(client(vials(10, 3)), "o1"))?.productSlugs,
      ).toEqual(["a"]);
      // Тоолж эхлээгүй сав (null) — хязгааргүй.
      expect(
        (await stockScopeForOrder(client(vials(null, 50)), "o1"))?.productSlugs,
      ).toEqual(["a"]);
    } finally {
      flags.clear();
    }
  });
});

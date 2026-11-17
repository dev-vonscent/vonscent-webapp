import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
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
            { product_id: "p1", products: { slug: "a" }, collections: { slug: "set-1" } },
            { product_id: "p2", products: { slug: "b" }, collections: [{ slug: "set-1" }] },
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
    });
  });

  it("бараагүй бол багцын гишүүнчлэлийг асуухгүй", async () => {
    const seen: string[] = [];
    const scope = await stockScopeForOrder(
      client({ order_items: { data: [], error: null } }, seen),
      "o1",
    );
    expect(scope).toEqual({ productSlugs: [], collectionSlugs: [] });
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
            data: [{ product_id: "p1", products: { slug: "a" }, collections: null }],
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

import { describe, expect, it } from "vitest";
import { groupBundleLines, type OrderLineInput } from "./bundle-lines";

const line = (over: Partial<OrderLineInput>): OrderLineInput => ({
  product_name: "Aventus",
  brand: "Creed",
  ml: 5,
  qty: 1,
  unit_price: 30000,
  list_price: 35000,
  is_gift: false,
  collection_id: null,
  collection_name: null,
  ...over,
});

describe("groupBundleLines", () => {
  const base = new Set(["gentleman"]);

  it("collapses a base bundle's members into one line", () => {
    const items = [
      line({ product_name: "Solo" }),
      line({
        collection_id: "gentleman",
        collection_name: "Gentleman",
        qty: 2,
      }),
      line({
        product_name: "Sauvage",
        collection_id: "gentleman",
        collection_name: "Gentleman",
        qty: 2,
        list_price: 25000,
      }),
    ];
    const out = groupBundleLines(items, base);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ kind: "item" });
    expect(out[1]).toMatchObject({
      kind: "bundle",
      name: "Gentleman",
      ml: 5,
      qty: 2,
      base: 35000 * 2 + 25000 * 2,
    });
  });

  it("keeps custom bundles, gifts and other sizes apart", () => {
    const items = [
      line({ collection_id: "mine", collection_name: "Миний багц" }),
      line({ collection_id: "gentleman", is_gift: true }),
      line({ collection_id: "gentleman", ml: 5 }),
      line({ collection_id: "gentleman", ml: 10 }),
    ];
    expect(groupBundleLines(items, base).map((l) => l.kind)).toEqual([
      "item",
      "item",
      "bundle",
      "bundle",
    ]);
  });
});

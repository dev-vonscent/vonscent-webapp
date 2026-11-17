import { describe, expect, it } from "vitest";
import { applyLivePrices, repriceCollection, repriceItem } from "./live-prices";
import type { CartCollection, CartItem } from "./store";

const item = (over: Partial<CartItem> = {}): CartItem => ({
  key: "v1",
  productId: "p1",
  slug: "most-wanted",
  name: "The Most Wanted",
  brand: "Azzaro",
  variantId: "v1",
  ml: 2,
  // Сагсанд нэмэх үед хямдралтай байсан: 18,000 → 15,300.
  unitPrice: 15_300,
  qty: 2,
  image: null,
  ...over,
});

const bundle = (over: Partial<CartCollection> = {}): CartCollection => ({
  key: "b1:5",
  collectionId: "b1",
  type: "base",
  slug: "clean-girl",
  name: "CLEAN GIRL",
  image: null,
  discountPct: 5,
  ml: 5,
  members: [
    {
      productId: "p1",
      variantId: "m1",
      slug: "a",
      name: "A",
      brand: "X",
      image: null,
      price: 40_000,
    },
    {
      productId: "p2",
      variantId: "m2",
      slug: "b",
      name: "B",
      brand: "Y",
      image: null,
      price: 60_000,
    },
  ],
  unitPrice: 95_000,
  qty: 1,
  ...over,
});

describe("repriceItem", () => {
  it("хямдрал дууссан бол үндсэн үнэд буцна", () => {
    const next = repriceItem(item(), {
      price: 18_000,
      basePrice: 18_000,
      saleLabel: null,
    });
    expect(next.unitPrice).toBe(18_000);
    expect(next.basePrice).toBe(18_000);
  });

  it("өөрчлөлтгүй бол ижил лавлагаа (дахин render-гүй)", () => {
    const i = item({ basePrice: 18_000, saleLabel: "Black Friday" });
    expect(
      repriceItem(i, {
        price: 15_300,
        basePrice: 18_000,
        saleLabel: "Black Friday",
      }),
    ).toBe(i);
  });

  it("мэдээлэлгүй мөр хөндөгдөхгүй", () => {
    const i = item();
    expect(repriceItem(i, undefined)).toBe(i);
  });
});

describe("repriceCollection", () => {
  it("гишүүний үндсэн үнэ өсвөл багцын үнэ шинэчлэгдэнэ", () => {
    const next = repriceCollection(bundle(), {
      price: 104_500,
      discountPct: 5,
      members: [
        { variantId: "m1", price: 50_000 },
        { variantId: "m2", price: 60_000 },
      ],
    });
    expect(next.unitPrice).toBe(104_500);
    expect(next.members.map((m) => m.price)).toEqual([50_000, 60_000]);
  });

  it("гишүүд таарахгүй бол (бүрэлдэхүүн өөр) хөндөхгүй", () => {
    const c = bundle();
    expect(
      repriceCollection(c, {
        price: 1,
        discountPct: 5,
        members: [{ variantId: "zz", price: 1 }],
      }),
    ).toBe(c);
  });
});

describe("applyLivePrices", () => {
  it("төлөх үнэ өөрчлөгдсөн мөрүүдийг нэрлэнэ, «Захиалах» мөрийг ч шинэчилнэ", () => {
    const buy = item({ key: "v9", variantId: "v9", name: "Aventus", ml: 5 });
    const res = applyLivePrices(
      {
        items: [item()],
        collections: [bundle()],
        buyNow: { kind: "item", item: buy },
      },
      {
        variants: {
          v1: { price: 18_000, basePrice: 18_000 },
          v9: { price: 45_000, basePrice: 45_000 },
        },
      },
    );
    expect(res.items[0].unitPrice).toBe(18_000);
    expect(res.buyNow?.kind === "item" && res.buyNow.item.unitPrice).toBe(
      45_000,
    );
    expect(res.changed).toEqual(["The Most Wanted 2ml", "Aventus 5ml"]);
  });

  it("зөвхөн үндсэн үнэ нөхөгдсөн бол мэдэгдэхгүй", () => {
    const state = { items: [item()], collections: [], buyNow: null };
    const res = applyLivePrices(state, {
      variants: { v1: { price: 15_300, basePrice: 18_000 } },
    });
    expect(res.changed).toEqual([]);
    expect(res.items[0].basePrice).toBe(18_000);
  });

  it("юу ч өөрчлөгдөөгүй бол массивын лавлагаа хэвээр", () => {
    const state = { items: [item()], collections: [bundle()], buyNow: null };
    const res = applyLivePrices(state, {});
    expect(res.items).toBe(state.items);
    expect(res.collections).toBe(state.collections);
  });
});

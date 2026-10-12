import { describe, it, expect } from "vitest";
import { SEED_PRODUCTS } from "@/features/products/seed";
import type { ProductDetail, Variant } from "@/lib/types";
import { cheapestVariant, isAddable, wishlistCartLines } from "./cart-lines";

const base = SEED_PRODUCTS[0]!;

function variant(
  id: string,
  ml: number,
  price: number,
  sellable: boolean,
): Variant {
  return {
    id,
    ml,
    price,
    basePrice: price,
    isActive: true,
    inStock: sellable,
    bottleLocked: false,
    sellable,
    unavailableReason: sellable ? null : "stock",
  };
}

function product(overrides: Partial<ProductDetail>): ProductDetail {
  return { ...base, ...overrides };
}

describe("isAddable", () => {
  it("зарагдаж буй ус орно", () => {
    expect(isAddable(product({ soldOut: false }))).toBe(true);
  });

  it("дууссан ус орохгүй", () => {
    expect(isAddable(product({ soldOut: true }))).toBe(false);
  });

  // «Тун удахгүй» (0125) нь mapProduct дээр soldOut=true байдаг ч энэ
  // шалгалт тэр дүрмээс хамаарахгүй байх ёстой.
  it("«Тун удахгүй» ус soldOut=false байсан ч орохгүй", () => {
    expect(isAddable(product({ soldOut: false, comingSoon: true }))).toBe(
      false,
    );
  });
});

describe("cheapestVariant", () => {
  it("хамгийн хямд ЗАРАГДАХ хэмжээг сонгоно — зарагдахгүй хямдыг алгасна", () => {
    const p = product({
      variants: [
        variant("a-2", 2, 9000, false),
        variant("a-5", 5, 30000, true),
        variant("a-10", 10, 52000, true),
      ],
    });
    expect(cheapestVariant(p)?.id).toBe("a-5");
  });

  it("зарагдах хэмжээгүй бол null", () => {
    const p = product({ variants: [variant("a-5", 5, 30000, false)] });
    expect(cheapestVariant(p)).toBeNull();
  });
});

describe("wishlistCartLines («Бүгдийг сагслах»)", () => {
  const live = product({
    id: "live",
    slug: "live",
    soldOut: false,
    variants: [
      variant("live-10", 10, 60000, true),
      variant("live-5", 5, 32000, true),
    ],
  });
  const soldOut = product({
    id: "sold",
    slug: "sold",
    soldOut: true,
    variants: [variant("sold-5", 5, 30000, false)],
  });
  // Үлдэгдэлтэй, хэмжээ нь sellable гэж ирсэн ч «Тун удахгүй» — давхар хамгаалалт.
  const comingSoon = product({
    id: "soon",
    slug: "soon",
    soldOut: false,
    comingSoon: true,
    variants: [variant("soon-5", 5, 40000, true)],
  });

  it("зөвхөн зарагдаж буй усыг хамгийн хямд хэмжээгээр нь нэмнэ", () => {
    const lines = wishlistCartLines([soldOut, live, comingSoon]);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      productId: "live",
      variantId: "live-5",
      ml: 5,
      unitPrice: 32000,
    });
  });

  it("«Тун удахгүй» ба дууссан ус л байвал юу ч нэмэхгүй", () => {
    expect(wishlistCartLines([soldOut, comingSoon])).toEqual([]);
  });

  it("soldOut=false боловч зарагдах хэмжээгүй усыг алгасна", () => {
    const stale = product({
      id: "stale",
      soldOut: false,
      variants: [variant("stale-5", 5, 30000, false)],
    });
    expect(wishlistCartLines([stale])).toEqual([]);
  });
});

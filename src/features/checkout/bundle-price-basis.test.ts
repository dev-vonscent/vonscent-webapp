import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Багцын үнийн суурь (Тайлан11.11.pptx слайд 2, docs/campaigns/plan.md §5.3):
 * бэлэн багц гишүүний ҮНДСЭН үнээс (барааны хямдрал нөлөөлөхгүй), угсарсан
 * багц хямдарсан үнээс дахин хувь хасна. `priceCollectionLines` нь
 * захиалгын `unit_price`-ийг бодох мөнгөний зам — харагдах үнэ
 * (`memberPrices`)-тэй нэг дүрэмтэй байх ёстой.
 */

const product = (id: string, variantId: string, base: number, eff: number) => ({
  id,
  name: id,
  brand: "B",
  soldOut: false,
  availableMl: 500,
  variants: [
    { id: variantId, ml: 5, price: eff, basePrice: base, sellable: true },
  ],
});

vi.mock("@/features/products/api", () => ({
  fetchProducts: vi.fn(async () => [
    // A: 40,000 → арга хэмжээгээр 32,000 (−20%); B: хямдралгүй 60,000.
    product("A", "va", 40000, 32000),
    product("B", "vb", 60000, 60000),
  ]),
  getProductById: vi.fn(),
}));

vi.mock("@/features/collections/api", () => ({
  getCollectionSettings: vi.fn(async () => ({
    customEnabled: true,
    customDiscountPct: 10,
    minItems: 2,
    maxItems: null,
    roundTo: 100,
  })),
  getCollectionOrderInfo: vi.fn(async () => ({
    name: "Бэлэн багц",
    discountPct: 10,
    mlDiscounts: {},
    memberProductIds: ["A", "B"],
  })),
}));

vi.mock("@/features/content/api", () => ({ getShippingSettings: vi.fn() }));

const { priceCollectionLines } = await import("./api");

const sum = (lines: { unitPrice: number }[]) =>
  lines.reduce((s, l) => s + l.unitPrice, 0);

describe("priceCollectionLines — бэлэн ба угсарсан багц (plan §5.3)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("бэлэн багц: үндсэн үнийн нийлбэр − 10% (хямдрал нөлөөлөхгүй)", async () => {
    const { lines } = await priceCollectionLines([
      {
        collectionId: "c1",
        type: "base",
        ml: 5,
        qty: 1,
        memberVariantIds: ["va", "vb"],
      },
    ]);
    // (40,000 + 60,000) × 0.9 = 90,000 — A-гийн −20% дамжихгүй.
    expect(sum(lines)).toBe(90000);
    // Гишүүдэд үндсэн үнийн жингээр хуваагдана: 36,000 / 54,000.
    expect(lines.map((l) => l.unitPrice)).toEqual([36000, 54000]);
  });

  it("угсарсан багц: хямдарсан үнийн нийлбэр − 10% (давхарлана)", async () => {
    const { lines } = await priceCollectionLines([
      {
        collectionId: null,
        type: "custom",
        ml: 5,
        qty: 1,
        memberVariantIds: ["va", "vb"],
      },
    ]);
    // (32,000 + 60,000) × 0.9 = 82,800.
    expect(sum(lines)).toBe(82800);
  });
});

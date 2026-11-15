import { describe, expect, it } from "vitest";
import type { SaleEventProduct } from "../../types";
import {
  previewBadge,
  previewCards,
  previewDuration,
} from "./catalog-preview-model";

const product = (
  id: string,
  prices: Record<number, number>,
): SaleEventProduct => ({
  id,
  name: `Бараа ${id}`,
  brand: "Брэнд",
  gender: "unisex",
  image: null,
  prices,
});

const byId = new Map(
  [
    product("a", { 2: 10_000, 5: 22_000, 10: 40_000 }),
    product("b", { 5: 30_000 }),
    product("c", {}),
    product("d", { 2: 9_000 }),
    product("e", { 2: 8_000 }),
  ].map((p) => [p.id, p]),
);

describe("previewCards", () => {
  it("хувьтай хэмжээний үнийг бууруулж, хамгийн багыг эхлэх үнэ болгоно", () => {
    const [card] = previewCards([{ productId: "a", pcts: { 5: "60" } }], byId);
    // 5ml: 22,000 − 60% = 8,800 < 2ml-ийн 10,000.
    expect(card).toMatchObject({ price: 8_800, basePrice: 22_000, discounted: true });
  });

  it("хувьгүй бараа үнээрээ, хямдраагүй", () => {
    const [card] = previewCards([{ productId: "a", pcts: {} }], byId);
    expect(card).toMatchObject({ price: 10_000, basePrice: 10_000, discounted: false });
  });

  it("буруу / хоосон хувийг тооцохгүй", () => {
    const [card] = previewCards(
      [{ productId: "b", pcts: { 5: "abc", 2: "" } }],
      byId,
    );
    expect(card).toMatchObject({ price: 30_000, discounted: false });
  });

  it("үнэгүй бараанд үнэ null", () => {
    const [card] = previewCards([{ productId: "c", pcts: { 2: "20" } }], byId);
    expect(card).toMatchObject({ price: null, basePrice: null, discounted: false });
  });

  it("эхний 4-ийг авна; олдохгүй барааг алгасна", () => {
    const cards = previewCards(
      ["zzz", "a", "b", "c", "d", "e"].map((productId) => ({
        productId,
        pcts: {},
      })),
      byId,
    );
    expect(cards.map((c) => c.id)).toEqual(["a", "b", "c", "d"]);
  });
});

describe("previewBadge", () => {
  it("арга хэмжээний тэмдэг түрүүлнэ", () => {
    expect(previewBadge(" Black Friday ", false)).toBe("Black Friday");
  });
  it("хоосон бол зөвхөн хямдарсан бараанд «Хямдрал»", () => {
    expect(previewBadge("", true)).toBe("Хямдрал");
    expect(previewBadge("  ", false)).toBeNull();
  });
});

describe("previewDuration", () => {
  it("эхлэх мөчөөс дуусах өдрийн төгсгөл хүртэл (мс)", () => {
    expect(previewDuration("2026-11-23", "2026-11-30")).toBe(8 * 86_400_000);
    expect(previewDuration("2026-11-23", "2026-11-23")).toBe(86_400_000);
  });
  it("огноо дутуу эсвэл урвуу бол null", () => {
    expect(previewDuration("", "2026-11-30")).toBeNull();
    expect(previewDuration("2026-11-30", "2026-11-23")).toBeNull();
  });
});

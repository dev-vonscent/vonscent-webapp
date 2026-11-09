import { describe, expect, it } from "vitest";
import {
  effectivePrice,
  isSaleActive,
  roundSalePrice,
  variantSaleColumns,
} from "./sale";

const now = new Date("2026-10-27T12:00:00Z");
const base = { price: 30000, sale_price: 25000 };

describe("isSaleActive", () => {
  it("хугацаагүй хямдрал байнга хүчинтэй", () => {
    expect(isSaleActive(base, now)).toBe(true);
    expect(effectivePrice(base, now)).toBe(25000);
  });

  it("хямдралгүй, эсвэл үндсэн үнээс багагүй бол хямдрал биш", () => {
    expect(isSaleActive({ price: 30000, sale_price: null }, now)).toBe(false);
    expect(isSaleActive({ price: 30000, sale_price: 30000 }, now)).toBe(false);
  });

  it("эхлээгүй хямдрал үндсэн үнээр", () => {
    const v = { ...base, sale_starts_at: "2026-10-28T00:00:00Z" };
    expect(isSaleActive(v, now)).toBe(false);
    expect(effectivePrice(v, now)).toBe(30000);
  });

  it("хугацаа дотор хүчинтэй", () => {
    const v = {
      ...base,
      sale_starts_at: "2026-10-27T00:00:00Z",
      sale_ends_at: "2026-10-30T00:00:00Z",
    };
    expect(isSaleActive(v, now)).toBe(true);
  });

  it("дууссан хямдрал энгийн үнэ рүү буцна (дуусах мөч өөрөө дууссан)", () => {
    const ended = { ...base, sale_ends_at: "2026-10-27T12:00:00Z" };
    expect(isSaleActive(ended, now)).toBe(false);
    expect(effectivePrice(ended, now)).toBe(30000);
  });
});

describe("roundSalePrice", () => {
  it("ойрын 100₮ руу: 10560 → 10600, 10540 → 10500, 10550 → 10600", () => {
    expect(roundSalePrice(10560, 30000)).toBe(10600);
    expect(roundSalePrice(10540, 30000)).toBe(10500);
    expect(roundSalePrice(10550, 30000)).toBe(10600);
  });

  it("тоймлоод үндсэн үнээс давахгүй", () => {
    expect(roundSalePrice(10560, 10580)).toBe(10580);
  });
});

describe("variantSaleColumns", () => {
  it("гараар бичсэн үнийг тоймлон бичнэ", () => {
    expect(
      variantSaleColumns({
        price: 30000,
        salePrice: 10560,
        saleStartsAt: null,
        saleEndsAt: null,
      }).sale_price,
    ).toBe(10600);
  });
});

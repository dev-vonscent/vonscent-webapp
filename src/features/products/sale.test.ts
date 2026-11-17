import { describe, expect, it } from "vitest";
import {
  effectivePrice,
  isSaleActive,
  roundSalePrice,
  saleLinkPatch,
  salePhase,
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

describe("salePhase", () => {
  it("хямдралгүй бол null", () => {
    expect(salePhase({ price: 30000, sale_price: null }, now)).toBeNull();
    expect(salePhase({ price: 30000, sale_price: 30000 }, now)).toBeNull();
  });

  it("хүчинтэй / эхлээгүй / дууссан", () => {
    expect(salePhase(base, now)).toBe("active");
    expect(
      salePhase({ ...base, sale_starts_at: "2026-10-28T00:00:00Z" }, now),
    ).toBe("scheduled");
    // 16.1: дууссан хямдралын sale_price санд үлддэг — «хямдралтай» биш.
    expect(
      salePhase({ ...base, sale_ends_at: "2026-10-27T12:00:00Z" }, now),
    ).toBe("ended");
  });
});

describe("saleLinkPatch (0188)", () => {
  const prev = {
    sale_price: 27000,
    sale_starts_at: null,
    sale_ends_at: "2026-11-21T16:00:00+00:00",
    sale_id: "s1",
  };

  it("өөрчлөөгүй бол хямдралд хэвээр (ISO хэлбэр өөр ч ижил мөч)", () => {
    expect(
      saleLinkPatch(prev, {
        ...prev,
        sale_ends_at: "2026-11-21T16:00:00.000Z",
      }),
    ).toEqual({});
  });

  it("үнэ эсвэл хугацааг гараар өөрчилбөл салгана", () => {
    expect(saleLinkPatch(prev, { ...prev, sale_price: 25000 })).toEqual({
      sale_id: null,
    });
    expect(
      saleLinkPatch(prev, { ...prev, sale_ends_at: "2026-11-25T16:00:00Z" }),
    ).toEqual({ sale_id: null });
    expect(
      saleLinkPatch(prev, {
        sale_price: null,
        sale_starts_at: null,
        sale_ends_at: null,
      }),
    ).toEqual({ sale_id: null });
  });

  it("хямдралгүй / шинэ хэмжээ → юу ч үгүй", () => {
    expect(saleLinkPatch(undefined, prev)).toEqual({});
    expect(
      saleLinkPatch({ ...prev, sale_id: null }, { ...prev, sale_price: 1 }),
    ).toEqual({});
  });
});

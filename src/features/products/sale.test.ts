import { describe, expect, it } from "vitest";
import {
  earliestEnd,
  effectivePrice,
  isOnSale,
  saleEndsAt,
  salePct,
  salePctText,
  summarizeSale,
  productSalePhase,
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

describe("isOnSale / productSalePhase (16.1)", () => {
  const v = (
    extra: Partial<{
      salePrice: number | null;
      saleStartsAt: string | null;
      saleEndsAt: string | null;
    }>,
  ) => ({
    price: 30000,
    salePrice: 25000,
    saleStartsAt: null,
    saleEndsAt: null,
    ...extra,
  });
  const t = now.getTime();

  it("дууссан хямдрал «хямдралтай» биш", () => {
    const ended = { variants: [v({ saleEndsAt: "2026-10-27T12:00:00Z" })] };
    expect(productSalePhase(ended, t)).toBe("ended");
    expect(isOnSale(ended, t)).toBe(false);
  });

  it("аль нэг хэмжээ хүчинтэй / эхлээгүй бол хямдралтай", () => {
    expect(isOnSale({ variants: [v({}), v({ salePrice: null })] }, t)).toBe(
      true,
    );
    expect(
      isOnSale({ variants: [v({ saleStartsAt: "2026-10-28T00:00:00Z" })] }, t),
    ).toBe(true);
    expect(isOnSale({ variants: [v({ salePrice: null })] }, t)).toBe(false);
  });
});

describe("salePct", () => {
  it("бүхэл хувь, хямдралгүй бол 0", () => {
    expect(salePct(30000, 27000)).toBe(10);
    expect(salePct(30000, 30000)).toBe(0);
    expect(salePct(30000, 31000)).toBe(0);
    expect(salePct(0, 0)).toBe(0);
  });
  it("маш бага зөрүү ч 1% — «0%» гэж гарахгүй", () => {
    expect(salePct(100000, 99900)).toBe(1);
  });
  it("тоймлолт: 12.5% → 13%", () => {
    expect(salePct(16000, 14000)).toBe(13);
  });
});

describe("summarizeSale + salePctText (2.4)", () => {
  const size = (basePrice: number, price: number) => ({ basePrice, price });

  it("бүх хэмжээ ижил хувь → «10%»", () => {
    const s = summarizeSale([
      size(10000, 9000),
      size(20000, 18000),
      size(30000, 27000),
      size(50000, 45000),
    ]);
    expect(s).toEqual({ minPct: 10, maxPct: 10, allSizes: true });
    expect(salePctText(s)).toBe("10%");
  });

  it("бүх хэмжээ хямдралтай, хувь өөр → «10–30%»", () => {
    const s = summarizeSale([
      size(10000, 9000),
      size(20000, 16000),
      size(30000, 21000),
    ]);
    expect(salePctText(s)).toBe("10–30%");
  });

  it("аль нэг хэмжээ хямдралгүй → «~30%»", () => {
    const s = summarizeSale([
      size(10000, 10000),
      size(20000, 18000),
      size(30000, 21000),
    ]);
    expect(s).toEqual({ minPct: 10, maxPct: 30, allSizes: false });
    expect(salePctText(s)).toBe("~30%");
  });

  it("ганц хэмжээ хямдралтай, бусад нь үгүй → «~10%»", () => {
    expect(
      salePctText(summarizeSale([size(10000, 9000), size(20000, 20000)])),
    ).toBe("~10%");
  });

  it("хямдралгүй бол null", () => {
    expect(summarizeSale([size(10000, 10000)])).toBeNull();
    expect(summarizeSale([])).toBeNull();
    expect(salePctText(null)).toBeNull();
    expect(salePctText(undefined)).toBeNull();
  });
});

describe("saleEndsAt", () => {
  const ev = "2026-11-30T16:00:00Z";
  const manualEnd = "2026-11-20T16:00:00Z";
  // 10/31-нд дууссан гар хямдралын дараах өдөр (dev-ийн Polo EST.97).
  const nov = new Date("2026-11-18T00:00:00Z");

  it("бодит үнэ = гар хямдрал → гар хямдралын дуусах мөч", () => {
    expect(
      saleEndsAt(
        {
          price: 30000,
          sale_price: 27000,
          sale_ends_at: manualEnd,
          variant_price: 27000,
        },
        ev,
        now,
      ),
    ).toBe(manualEnd);
  });

  it("арга хэмжээ илүү хямд → арга хэмжээний дуусах мөч", () => {
    expect(
      saleEndsAt(
        {
          price: 30000,
          sale_price: 27000,
          sale_ends_at: manualEnd,
          variant_price: 24000,
        },
        ev,
        now,
      ),
    ).toBe(ev);
  });

  it("(1) дууссан гар хямдрал + LIVE арга хэмжээ ИЖИЛ үнэ → арга хэмжээний мөч (Polo EST.97, PR #290)", () => {
    const polo = {
      price: 15000,
      sale_price: 13500,
      sale_ends_at: "2026-10-31T16:00:00Z", // `now`-оос өмнө — дууссан
      variant_price: 13500, // BF 10%
    };
    // SQL label (0189) — арга хэмжээ.
    expect(
      saleEndsAt({ ...polo, variant_sale_label: "Black Friday" }, ev, nov),
    ).toBe(ev);
    // Label мэдэгдэхгүй ч дууссан гар хямдралыг сонгохгүй.
    expect(saleEndsAt(polo, ev, nov)).toBe(ev);
  });

  it("(2) хүчинтэй хугацаагүй гар хямдрал + арга хэмжээ → SQL-ийн дүрмээр", () => {
    const v = { price: 30000, sale_price: 24000, sale_ends_at: null };
    // Гар хямдрал хямд → label null → гар хямдрал, хугацаагүй.
    expect(
      saleEndsAt(
        { ...v, variant_price: 24000, variant_sale_label: null },
        ev,
        now,
      ),
    ).toBeNull();
    // Ижил үнэ → SQL арга хэмжээг сонгоно (label) → арга хэмжээний мөч.
    expect(
      saleEndsAt(
        { ...v, variant_price: 24000, variant_sale_label: "Black Friday" },
        ev,
        now,
      ),
    ).toBe(ev);
    // Арга хэмжээ хямд → арга хэмжээ.
    expect(
      saleEndsAt(
        { ...v, variant_price: 21000, variant_sale_label: "Black Friday" },
        ev,
        now,
      ),
    ).toBe(ev);
  });

  it("(3) зөвхөн дууссан sale_price → хямдралгүй", () => {
    expect(
      saleEndsAt(
        {
          price: 15000,
          sale_price: 13500,
          sale_ends_at: "2026-10-31T16:00:00Z",
          variant_price: 15000,
          variant_sale_label: null,
        },
        null,
        nov,
      ),
    ).toBeUndefined();
    // Demo (variant_price-гүй) ч мөн адил.
    expect(
      saleEndsAt(
        {
          price: 15000,
          sale_price: 13500,
          sale_ends_at: "2026-10-31T16:00:00Z",
        },
        null,
        nov,
      ),
    ).toBeUndefined();
  });

  it("эхлээгүй гар хямдрал label-гүй ирвэл хугацааг авахгүй", () => {
    expect(
      saleEndsAt(
        {
          price: 30000,
          sale_price: 27000,
          sale_starts_at: "2026-11-01T00:00:00Z",
          sale_ends_at: manualEnd,
          variant_price: 27000,
          variant_sale_label: null,
        },
        null,
        now,
      ),
    ).toBeNull();
  });

  it("хугацаагүй гар хямдрал → null; хямдралгүй → undefined", () => {
    expect(
      saleEndsAt(
        { price: 30000, sale_price: 27000, variant_price: 27000 },
        ev,
        now,
      ),
    ).toBeNull();
    expect(
      saleEndsAt(
        { price: 30000, sale_price: null, variant_price: 30000 },
        ev,
        now,
      ),
    ).toBeUndefined();
  });

  it("variant_price байхгүй (demo) → isSaleActive", () => {
    expect(
      saleEndsAt(
        { price: 30000, sale_price: 27000, sale_ends_at: manualEnd },
        null,
        now,
      ),
    ).toBe(manualEnd);
  });
});

describe("earliestEnd", () => {
  it("хамгийн ойрыг, хоосныг алгасаж", () => {
    expect(
      earliestEnd([
        null,
        "2026-11-30T16:00:00Z",
        undefined,
        "2026-11-20T16:00:00Z",
      ]),
    ).toBe("2026-11-20T16:00:00Z");
    expect(earliestEnd([null, undefined])).toBeNull();
  });

  it("now өгвөл өнгөрсөн мөчийг алгасна", () => {
    const t = Date.parse("2026-11-18T00:00:00Z");
    expect(
      earliestEnd(["2026-10-31T16:00:00Z", "2026-11-21T16:00:00Z"], t),
    ).toBe("2026-11-21T16:00:00Z");
    expect(earliestEnd(["2026-10-31T16:00:00Z"], t)).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { filterByEvent, parseCollectionSort, sortCollections } from "./browse";

const bf = (endsAt?: string) => ({
  slug: "black-friday",
  name: "Black Friday",
  pcts: {},
  ...(endsAt ? { endsAt } : {}),
});

const c = (
  id: string,
  max: number,
  over: {
    startingPrice?: number;
    isFeatured?: boolean;
    event?: ReturnType<typeof bf> | null;
  } = {},
) => ({
  id,
  isFeatured: over.isFeatured ?? false,
  startingPrice: over.startingPrice ?? 100_000,
  discountRange: { min: max, max },
  event: over.event ?? null,
});
const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

describe("sortCollections — «Хямдрал: их → бага»", () => {
  it("хэмнэх ₮ биш хувиар: 10% / 5% / 10% → 10%, 10%, 5%", () => {
    // LUXURY 10% (≈15,100₮), LOUIS VUITTON 5% (≈9,400₮), OFFICE 10% (≈9,100₮).
    const list = [
      c("luxury", 10, { startingPrice: 151_000 }),
      c("louis-vuitton", 5, { startingPrice: 188_000 }),
      c("office", 10, { startingPrice: 91_000 }),
    ];
    expect(ids(sortCollections(list, "discount"))).toEqual([
      "luxury",
      "office",
      "louis-vuitton",
    ]);
  });

  it("хувь ижил бол арга хэмжээ дуусах мөч ойр нь эхэнд, хугацаагүй нь ард", () => {
    const list = [
      c("base-10", 10),
      c("late", 10, { event: bf("2026-11-30T16:00:00Z") }),
      c("soon", 10, { event: bf("2026-11-21T16:00:00Z") }),
    ];
    expect(ids(sortCollections(list, "discount"))).toEqual([
      "soon",
      "late",
      "base-10",
    ]);
  });

  it("бүгд ижил бол оролтын дараалал хадгалагдана (тогтвортой)", () => {
    const list = [c("a", 5), c("b", 5), c("c", 5)];
    expect(ids(sortCollections(list, "discount"))).toEqual(["a", "b", "c"]);
    expect(ids(list)).toEqual(["a", "b", "c"]);
  });

  it("«Онцлох эхэндээ» хэвээр", () => {
    const list = [c("a", 10), c("f", 5, { isFeatured: true })];
    expect(ids(sortCollections(list, "featured"))).toEqual(["f", "a"]);
  });
});

describe("parseCollectionSort", () => {
  it("хуучин sort=saved → discount; мэдэгдэхгүй → featured", () => {
    expect(parseCollectionSort("saved")).toBe("discount");
    expect(parseCollectionSort("discount")).toBe("discount");
    expect(parseCollectionSort("price_asc")).toBe("price_asc");
    expect(parseCollectionSort("nope")).toBe("featured");
    expect(parseCollectionSort(null)).toBe("featured");
  });
});

describe("filterByEvent — арга хэмжээний chip", () => {
  const list = [
    c("lux", 10, { event: bf() }),
    c("lv", 5),
    c("office", 10, { event: bf() }),
  ];

  it("LIVE event сонговол зөвхөн тэр event-ийн багцууд", () => {
    expect(ids(filterByEvent(list, "black-friday", ["black-friday"]))).toEqual([
      "lux",
      "office",
    ]);
  });

  it("туг хаалттай (liveSlugs хоосон) эсвэл дууссан event → шүүлтгүй", () => {
    expect(ids(filterByEvent(list, "black-friday", []))).toEqual([
      "lux",
      "lv",
      "office",
    ]);
    expect(
      ids(filterByEvent(list, "old-event", ["black-friday"])),
    ).toHaveLength(3);
    expect(ids(filterByEvent(list, null, ["black-friday"]))).toHaveLength(3);
  });
});

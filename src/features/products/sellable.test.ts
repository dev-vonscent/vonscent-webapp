import { describe, it, expect } from "vitest";
import { maxUnits, variantAvailability } from "./sellable";

/**
 * Савны түгжээ (0095) нэмэгдэхэд «зарагдах эсэх» гурван бие даасан
 * шалтгаантай болсон. Гурвуулангийн хослолыг тогтоож өгнө — SQL талын
 * `variant_sellable()` энэ хүснэгтээс хазайвал дэлгүүр ба сан зөрнө.
 */
describe("variantAvailability", () => {
  const cases: {
    isActive: boolean;
    inStock: boolean;
    bottleLocked: boolean;
    sellable: boolean;
    reason: string | null;
  }[] = [
    { isActive: true, inStock: true, bottleLocked: false, sellable: true, reason: null },
    // Сав дууссан — бараа өөрөө байгаа ч тэр хэмжээг цутгах юм алга.
    { isActive: true, inStock: true, bottleLocked: true, sellable: false, reason: "bottle" },
    { isActive: true, inStock: false, bottleLocked: false, sellable: false, reason: "stock" },
    // Хоёулаа буруу бол САВ нь түр зуурынх учраас түүнийг хэлнэ.
    { isActive: true, inStock: false, bottleLocked: true, sellable: false, reason: "bottle" },
    // Админы гарын унтраалга бүхнээс дээгүүр: сав ирсэн ч энэ нээгдэхгүй.
    { isActive: false, inStock: true, bottleLocked: false, sellable: false, reason: "inactive" },
    { isActive: false, inStock: true, bottleLocked: true, sellable: false, reason: "inactive" },
    { isActive: false, inStock: false, bottleLocked: false, sellable: false, reason: "inactive" },
    { isActive: false, inStock: false, bottleLocked: true, sellable: false, reason: "inactive" },
  ];

  for (const c of cases) {
    it(`isActive=${c.isActive} inStock=${c.inStock} locked=${c.bottleLocked} → ${
      c.sellable ? "зарагдана" : c.reason
    }`, () => {
      expect(
        variantAvailability({
          isActive: c.isActive,
          inStock: c.inStock,
          bottleLocked: c.bottleLocked,
        }),
      ).toEqual({ sellable: c.sellable, unavailableReason: c.reason });
    });
  }

  it("савны түгжээ нь тухайн бараанд биш, ӨНГӨНД хамаарна", () => {
    // Түгжээ идэвхтэй ч админ энэ нэг барааг чөлөөлсөн (bottle_override) бол
    // `bottleLocked` худал болж ирнэ — mapProduct тэр шийдвэрийг гаргадаг.
    expect(
      variantAvailability({
        isActive: true,
        inStock: true,
        bottleLocked: false,
      }).sellable,
    ).toBe(true);
  });
});

/**
 * Үлдэгдэл 15ml дээр хэмжээ бүрийн ДЭЭД тоо ширхэг. Энэ хүснэгт бол
 * «20ml идэвхгүй мөртлөө 10ml-ээс 2 авч болдог» алдааны шууд шалгуур.
 */
describe("maxUnits", () => {
  const sellable = true;

  const table: [ml: number, remainingMl: number, expected: number][] = [
    [20, 15, 0],
    [10, 15, 1],
    [5, 15, 3],
    [2, 15, 7], // 1ml үлдэнэ — хагас сав цутгахгүй
    [10, 10, 1],
    [10, 9, 0],
    [5, 0, 0],
  ];

  for (const [ml, remainingMl, expected] of table) {
    it(`${remainingMl}ml үлдэгдэл дээр ${ml}ml → ${expected} ш`, () => {
      expect(maxUnits({ ml, sellable, remainingMl })).toBe(expected);
    });
  }

  it("зарагдахгүй хэмжээ үргэлж 0 — үлдэгдэл хэчнээн их байсан ч", () => {
    expect(maxUnits({ ml: 5, sellable: false, remainingMl: 500 })).toBe(0);
  });

  it("сөрөг үлдэгдэл (сагс аль хэдийн хэтэрсэн) → 0", () => {
    expect(maxUnits({ ml: 5, sellable, remainingMl: -3 })).toBe(0);
  });

  it("үлдэгдэл мэдэгдэхгүй бол хязгаарлахгүй", () => {
    expect(maxUnits({ ml: 5, sellable, remainingMl: Infinity })).toBe(Infinity);
    expect(maxUnits({ ml: 5, sellable, remainingMl: NaN })).toBe(0);
  });
});

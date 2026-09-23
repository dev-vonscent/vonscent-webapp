import { describe, expect, it } from "vitest";
import { findStockShortages, mlByProduct, type PricedLine } from "./api";

/**
 * Эх савны үлдэгдэл 15ml дээрх сценариуд. `variant_sellable()` (0095) нь
 * «нэг ширхэг цутгах ml хүрэлцэх үү» гэсэн асуулт тул 10ml зарагдана — гэвч
 * 10ml×2, эсвэл 10ml + 5ml + 2ml нийлээд савыг хэтрүүлнэ. Өмнө нь үүнийг
 * зөвхөн `place_order` барьдаг байсан ба хэрэглэгч ерөнхий алдаа авдаг байв.
 */
const line = (
  productId: string,
  ml: number,
  qty: number,
  extra: Partial<PricedLine> = {},
): PricedLine => ({
  productId,
  variantId: `${productId}-${ml}`,
  name: `Бараа ${productId}`,
  brand: "B",
  ml,
  qty,
  unitPrice: 1000,
  lineTotal: 1000 * qty,
  ...extra,
});

const stock = new Map([["p1", 15]]);

describe("mlByProduct", () => {
  it("нэг барааны мөрүүдийг нэмнэ", () => {
    const ml = mlByProduct([line("p1", 10, 1), line("p1", 5, 2), line("p2", 2, 1)]);
    expect(ml.get("p1")).toBe(20);
    expect(ml.get("p2")).toBe(2);
  });
});

describe("findStockShortages", () => {
  it("15ml дээр 10ml×2 → 1 ш хүртэл", () => {
    const [short, ...rest] = findStockShortages([line("p1", 10, 2)], stock);
    expect(rest).toHaveLength(0);
    expect(short).toMatchObject({
      productId: "p1",
      variantId: "p1-10",
      ml: 10,
      qty: 2,
      maxQty: 1,
      availableMl: 15,
    });
  });

  it("15ml дээр 10ml + 5ml → яг таарна, гомдол байхгүй", () => {
    expect(
      findStockShortages([line("p1", 10, 1), line("p1", 5, 1)], stock),
    ).toEqual([]);
  });

  it("гурав дахь мөр багтахгүй — өмнөх хоёр нь хөндөгдөхгүй", () => {
    const out = findStockShortages(
      [line("p1", 10, 1), line("p1", 5, 1), line("p1", 2, 1)],
      stock,
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ ml: 2, maxQty: 0 });
  });

  it("багц ба энгийн мөр нэг эх савнаас хасагдана", () => {
    const out = findStockShortages(
      [
        line("p1", 5, 2, { collectionName: "Миний багц" }), // 10ml
        line("p1", 10, 1), // үлдсэн 5ml дээр багтахгүй
      ],
      stock,
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ ml: 10, maxQty: 0 });
  });

  it("багцын мөр багцын нэрээ авч явна — гишүүнийг дангаар нь багасгах боломжгүй", () => {
    const out = findStockShortages(
      [line("p1", 10, 2, { collectionName: "Эрэгтэй багц" })],
      stock,
    );
    expect(out[0]?.collectionName).toBe("Эрэгтэй багц");
  });

  it("үлдэгдэл нь мэдэгдэхгүй бараа 0 гэж тооцогдоно (аюулгүй тал руу)", () => {
    const out = findStockShortages([line("p9", 2, 1)], stock);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ maxQty: 0, availableMl: 0 });
  });

  it("бэлгийн 1ml дээж сүүлд — төлбөртэй мөр савыг дуусгасан бол багтахгүй", () => {
    const out = findStockShortages(
      [line("p1", 5, 3), line("p1", 1, 1, { isGift: true })],
      stock,
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ ml: 1, maxQty: 0 });
  });
});

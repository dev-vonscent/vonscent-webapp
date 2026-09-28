import { describe, expect, it } from "vitest";
import { cartMlByProduct, cartMlFor } from "./budget";

/**
 * Сагсны «төсөв» — нэг барааны эх савнаас хэдэн ml явж байна. Энгийн мөр,
 * багц, бэлэг гурвыг нэг нийлбэрт оруулахгүй бол 10ml + 5ml гэсэн хоёр мөр
 * тус тусдаа зөв харагдаад 15ml-ийн үлдэгдлийг хэтрүүлнэ.
 */
describe("cartMlByProduct", () => {
  it("нэг барааны олон хэмжээ нийлнэ", () => {
    const ml = cartMlByProduct({
      items: [
        { productId: "p1", ml: 10, qty: 1 },
        { productId: "p1", ml: 5, qty: 1 },
        { productId: "p2", ml: 2, qty: 3 },
      ],
    });
    expect(ml.get("p1")).toBe(15);
    expect(ml.get("p2")).toBe(6);
  });

  it("тоо ширхэг үржигдэнэ", () => {
    expect(cartMlFor("p1", { items: [{ productId: "p1", ml: 10, qty: 2 }] })).toBe(20);
  });

  it("багцын гишүүн бүр багцын ml × багцын тоогоор тоологдоно", () => {
    const ml = cartMlByProduct({
      collections: [
        { ml: 5, qty: 2, members: [{ productId: "p1" }, { productId: "p2" }] },
      ],
    });
    expect(ml.get("p1")).toBe(10);
    expect(ml.get("p2")).toBe(10);
  });

  it("нэг бараа энгийн мөр ба багцад зэрэг байвал хоёулаа нэмэгдэнэ", () => {
    expect(
      cartMlFor("p1", {
        items: [{ productId: "p1", ml: 10, qty: 1 }],
        collections: [{ ml: 5, qty: 1, members: [{ productId: "p1" }] }],
      }),
    ).toBe(15);
  });

  it("бэлгийн дээж 1ml-ээр тоологдоно", () => {
    expect(cartMlFor("p1", { giftProductIds: ["p1"] })).toBe(1);
  });

  it("хоосон сагс → хоосон газрын зураг", () => {
    expect(cartMlByProduct({}).size).toBe(0);
  });
});

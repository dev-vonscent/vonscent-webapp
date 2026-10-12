import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ProductDetail, Variant } from "@/lib/types";
import { ComingSoonPurchase } from "./coming-soon-purchase";

function variant(ml: number, price: number, over: Partial<Variant> = {}) {
  return {
    id: `v${ml}`,
    ml,
    price,
    basePrice: price,
    isActive: true,
    inStock: false,
    bottleLocked: false,
    sellable: false,
    unavailableReason: "stock",
    ...over,
  } as Variant;
}

function product(over: Partial<ProductDetail> = {}): ProductDetail {
  return {
    id: "p1",
    slug: "aventus",
    name: "Aventus",
    brand: "Creed",
    soldOut: true,
    comingSoon: true,
    comingSoonNote: null,
    variants: [variant(5, 25000), variant(10, 45000)],
    ...over,
  } as unknown as ProductDetail;
}

describe("ComingSoonPurchase", () => {
  it("үнэ, хэмжээ харагдана — захиалах товч идэвхгүй", () => {
    render(<ComingSoonPurchase product={product()} />);
    expect(screen.getByText("5ml")).toBeTruthy();
    expect(screen.getByText("10ml")).toBeTruthy();
    const cta = screen.getByRole("button", {
      name: "Захиалга удахгүй нээгдэнэ",
    });
    expect(cta.hasAttribute("disabled")).toBe(true);
    // Сонгох, сагслах ямар ч товч байхгүй.
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("зарахгүй хэмжээний үнийг харуулахгүй", () => {
    render(
      <ComingSoonPurchase
        product={product({
          variants: [
            variant(5, 25000),
            variant(20, 90000, { isActive: false }),
          ],
        })}
      />,
    );
    expect(screen.queryByText("20ml")).toBeNull();
  });

  const WITH_NOTE =
    "Худалдаанд гармагц та энэ хуудаснаас шууд захиалах боломжтой.";
  const NO_NOTE =
    "Энэхүү үнэртэн тун удахгүй худалдаанд гарна. Бэлэн болмогц та энэ хуудаснаас шууд захиалах боломжтой.";

  it("note-ийг тусдаа мөрөнд бүтнээр нь, юу ч залгахгүй", () => {
    render(
      <ComingSoonPurchase
        product={product({ comingSoonNote: "10-р сарын сүүлээр" })}
      />,
    );
    // Тусдаа элемент — текст нь яг note-оор дуусна.
    const note = screen.getByText("10-р сарын сүүлээр");
    expect(note.textContent).toBe("10-р сарын сүүлээр");
    expect(screen.queryByText(/тун удахгүй худалдаанд гарна/)).toBeNull();
    // Захиалах боломжийн өгүүлбэр note-той үед ч гарна, өөр мөрөнд.
    const always = screen.getByText(WITH_NOTE);
    expect(always).not.toBe(note);
  });

  it("бүтэн өгүүлбэр бичсэн note давхар цэг, залгалтгүй", () => {
    render(
      <ComingSoonPurchase
        product={product({ comingSoonNote: "25-нд ирнэ." })}
      />,
    );
    expect(screen.getByText("25-нд ирнэ.").textContent).toBe("25-нд ирнэ.");
    expect(screen.getByText(WITH_NOTE)).toBeTruthy();
  });

  it("хугацаагүй бол ерөнхий мэдээ", () => {
    render(<ComingSoonPurchase product={product()} />);
    expect(screen.getByText(NO_NOTE)).toBeTruthy();
  });

  it("хоосон note-ийг ерөнхий мэдээгээр орлоно", () => {
    render(<ComingSoonPurchase product={product({ comingSoonNote: "" })} />);
    expect(screen.getByText(NO_NOTE)).toBeTruthy();
  });
});

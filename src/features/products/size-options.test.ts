import { describe, expect, it } from "vitest";
import type { Variant } from "@/lib/types";
import {
  defaultSizeId,
  productSizeOptions,
  sizeHint,
  spraysText,
} from "./size-options";

function v(ml: number, over: Partial<Variant> = {}): Variant {
  return {
    id: `v${ml}`,
    ml,
    price: ml * 5000,
    basePrice: ml * 5000,
    isActive: true,
    inStock: true,
    bottleLocked: false,
    sellable: true,
    unavailableReason: null,
    ...over,
  };
}

describe("size options (task 15, 4, 2.6)", () => {
  it("цацалт = ml × SPRAYS_PER_ML", () => {
    expect(spraysText(2)).toBe("≈ 30 цацалт");
    expect(spraysText(5)).toBe("≈ 75 цацалт");
    expect(spraysText(20)).toBe("≈ 300 цацалт");
  });

  it("хэмжээ бүрийн доорх зөвлөмж (SIZE_HINTS)", () => {
    expect(sizeHint(2)).toBe("Туршиж үзэхэд тохиромжтой");
    expect(sizeHint(5)).toBe("Халаасанд багтахуйц");
    expect(sizeHint(10)).toBe("Авч явахад тохиромжтой");
    expect(sizeHint(20)).toBe("Хамгийн хэмнэлттэй сонголт");
    expect(sizeHint(7)).toBeNull();
    expect(sizeHint(null)).toBeNull();
  });

  it("дууссан хэмжээ сонгогдоно, зарахгүй нь үгүй", () => {
    const opts = productSizeOptions([
      v(2),
      v(5, { inStock: false, sellable: false, unavailableReason: "stock" }),
      v(10, {
        bottleLocked: true,
        sellable: false,
        unavailableReason: "bottle",
      }),
      v(20, {
        isActive: false,
        sellable: false,
        unavailableReason: "inactive",
      }),
    ]);
    expect(opts.map((o) => [o.note, o.selectable, o.buyable])).toEqual([
      [null, true, true],
      ["Дууссан", true, false],
      ["Түр байхгүй", true, false],
      ["Зарахгүй", false, false],
    ]);
  });

  it("хямдралтай хэмжээг тэмдэглэнэ (үндсэн үнээс бага бодит үнэ)", () => {
    const opts = productSizeOptions([
      v(2),
      v(5, { price: 21000, basePrice: 25000 }),
    ]);
    expect(opts.map((o) => o.onSale)).toEqual([false, true]);
  });

  it("анхдагч: зарагдах хамгийн эхний хэмжээ, дууссаныг алгасна", () => {
    const out = {
      inStock: false,
      sellable: false,
      unavailableReason: "stock",
    } as const;
    expect(defaultSizeId(productSizeOptions([v(2, out), v(5), v(10)]))).toBe(
      "v5",
    );
    // Нэг ч зарагдахгүй бол сонгож болох эхнийх.
    expect(
      defaultSizeId(
        productSizeOptions([
          v(2, { isActive: false, sellable: false }),
          v(5, out),
        ]),
      ),
    ).toBe("v5");
  });
});

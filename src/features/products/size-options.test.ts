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
    expect(spraysText(2)).toBe("30 цацалт");
    expect(spraysText(5)).toBe("75 цацалт");
    expect(spraysText(20)).toBe("300 цацалт");
    expect(spraysText(5, true)).toBe("тус бүр 75 цацалт");
  });

  it("хэмжээ бүрийн доорх зөвлөмж (SIZE_HINTS)", () => {
    // 1ml-ийн үнэ: 6000 / 5000 / 4500 / 4000 — 20ml хамгийн хямд.
    const opts = productSizeOptions([
      v(2, { price: 12000, basePrice: 12000 }),
      v(5, { price: 25000, basePrice: 25000 }),
      v(10, { price: 45000, basePrice: 45000 }),
      v(20, { price: 80000, basePrice: 80000 }),
    ]);
    const hint = (i: number) => sizeHint(opts, opts[i])?.text;
    expect(hint(0)).toBe("Туршиж үзэхэд тохиромжтой");
    expect(hint(1)).toBe("Халаасанд багтахуйц");
    expect(hint(2)).toBe("Авч явахад тохиромжтой");
    expect(hint(3)).toBe("Хамгийн хэмнэлттэй сонголт");
    expect(sizeHint(opts, null)).toBeNull();
    expect(opts.map((o) => sizeHint(opts, o)?.kind)).toEqual([
      "trial",
      "pocket",
      "travel",
      "value",
    ]);
  });

  it("20ml-ийн 1ml-ийн үнэ хамгийн бага биш бол «Хамгийн том хэмжээ»", () => {
    // 10ml хямдарч 1ml нь 3,800₮ < 20ml-ийн 4,000₮.
    const opts = productSizeOptions([
      v(2, { price: 12000, basePrice: 12000 }),
      v(10, { price: 38000, basePrice: 45000 }),
      v(20, { price: 80000, basePrice: 80000 }),
    ]);
    expect(sizeHint(opts, opts[2])).toEqual({
      text: "Хамгийн том хэмжээ",
      kind: "largest",
    });
    // Тэнцүү бол хэмнэлттэй хэвээр.
    const tie = productSizeOptions([
      v(10, { price: 40000, basePrice: 40000 }),
      v(20, { price: 80000, basePrice: 80000 }),
    ]);
    expect(sizeHint(tie, tie[1])?.text).toBe("Хамгийн хэмнэлттэй сонголт");
  });

  it("«Зарахгүй» хэмжээ харьцуулалтад орохгүй, дууссан нь орно", () => {
    const cheap10 = { price: 30000, basePrice: 30000 };
    const off = productSizeOptions([
      v(10, { ...cheap10, isActive: false, sellable: false }),
      v(20, { price: 80000, basePrice: 80000 }),
    ]);
    expect(sizeHint(off, off[1])?.text).toBe("Хамгийн хэмнэлттэй сонголт");
    const sold = productSizeOptions([
      v(10, { ...cheap10, inStock: false, sellable: false }),
      v(20, { price: 80000, basePrice: 80000 }),
    ]);
    expect(sizeHint(sold, sold[1])?.text).toBe("Хамгийн том хэмжээ");
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
    expect(opts.map((o) => o.salePct)).toEqual([0, 16]);
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

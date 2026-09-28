import { describe, it, expect } from "vitest";
import { bundleSavingsOf, orderSummaryRows } from "./summary";

const base = {
  subtotal: 100_000,
  grossSubtotal: null as number | null,
  discount: 0,
  loyaltyUsed: 0,
  shippingFee: 8_000,
};

const labels = (o: Parameters<typeof orderSummaryRows>[0]) =>
  orderSummaryRows(o).map((r) => r.label);

describe("orderSummaryRows", () => {
  it("0097-оос өмнөх захиалгад ганц «Барааны дүн» мөр", () => {
    expect(labels(base)).toEqual(["Барааны дүн", "Хүргэлт"]);
  });

  it("багцын хямдрал байхад үндсэн үнэ ба хямдралыг тусад нь", () => {
    const rows = orderSummaryRows({ ...base, grossSubtotal: 120_000 });
    expect(rows[0]).toMatchObject({ label: "Нийт үндсэн үнэ" });
    expect(rows[1]).toMatchObject({
      label: "Багцын хямдрал",
      value: "−20,000₮",
      credit: true,
    });
  });

  it("хямдрал 0 бол (gross = subtotal) нэмэлт мөр гарахгүй", () => {
    expect(labels({ ...base, grossSubtotal: 100_000 })).toEqual([
      "Барааны дүн",
      "Хүргэлт",
    ]);
  });

  it("купоны код мөрийн шошгон дээр гарна", () => {
    const rows = orderSummaryRows({
      ...base,
      discount: 5_000,
      couponCode: "VS10",
    });
    expect(rows[1]).toMatchObject({ label: "Купон · VS10", value: "−5,000₮" });
  });

  it("багц + купон хоёулаа байхад «Хямдарсан үнэ» дэд дүн нэмэгдэнэ", () => {
    const rows = orderSummaryRows({
      ...base,
      grossSubtotal: 120_000,
      discount: 5_000,
    });
    expect(
      labels({ ...base, grossSubtotal: 120_000, discount: 5_000 }),
    ).toEqual([
      "Нийт үндсэн үнэ",
      "Багцын хямдрал",
      "Хөнгөлөлт",
      "Хямдарсан үнэ",
      "Хүргэлт",
    ]);
    expect(rows[3]).toMatchObject({ value: "95,000₮", strong: true });
  });

  it("үнэгүй хүргэлт «Үнэгүй» гэж бичигдэнэ", () => {
    const rows = orderSummaryRows({ ...base, shippingFee: 0 });
    expect(rows.at(-1)).toMatchObject({ label: "Хүргэлт", value: "Үнэгүй" });
  });

  it("bundleSavingsOf сөрөг утга буцаахгүй", () => {
    expect(bundleSavingsOf({ ...base, grossSubtotal: 90_000 })).toBe(0);
    expect(bundleSavingsOf(base)).toBe(0);
  });
});

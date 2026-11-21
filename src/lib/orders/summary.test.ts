import { describe, it, expect } from "vitest";
import { bundleSavingsOf, orderSummaryRows } from "./summary";
import { formatPrice } from "@/lib/format";

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

  it("багцын хямдралын дараа «Нийт барааны үнэ» купоноос ӨМНӨ (сл.8)", () => {
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
      "Нийт барааны үнэ",
      "Хөнгөлөлт",
      "Хүргэлт",
    ]);
    // Купон энэ дүнгээс бодогдоно — купоны дараах дүн биш.
    expect(rows[2]).toMatchObject({ value: "100,000₮", strong: true });
  });

  it("хувийн купон «Купон (10%)», мөнгөн купон «Купон · КОД»", () => {
    const pct = orderSummaryRows({
      ...base,
      discount: 10_000,
      couponCode: "VS10",
      couponPct: 10,
    });
    expect(pct[1]).toMatchObject({ label: "Купон (10%)", value: "−10,000₮" });
    const fixed = orderSummaryRows({
      ...base,
      discount: 5_000,
      couponCode: "VW5K",
      couponPct: null,
    });
    expect(fixed[1]).toMatchObject({ label: "Купон · VW5K" });
    // Дээд хязгаартай (max_discount) 10% купон таслагдсан → хувь тоотой
    // таарахгүй тул кодоор.
    const capped = orderSummaryRows({
      ...base,
      subtotal: 500_000,
      discount: 20_000,
      couponCode: "VS10",
      couponPct: 10,
    });
    expect(capped[1]).toMatchObject({ label: "Купон · VS10" });
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

/**
 * Задаргааны мөрүүдийн тэмдэгтэй нийлбэр — «Нийт барааны үнэ» (дэд дүн)-гээс
 * бусад нь. Эцсийн дүнтэй ЯГ таарах ёстой (task 10, шийдвэр 1).
 */
function signedSum(rows: ReturnType<typeof orderSummaryRows>): number {
  return rows
    .filter((r) => !r.strong)
    .reduce((sum, r) => {
      const n = Number(r.value.replace(/[^\d]/g, "")) || 0;
      return r.credit ? sum - n : sum + n;
    }, 0);
}

describe("orderSummaryRows — арга хэмжээ (0189)", () => {
  /**
   * Тайлангийн §1 жишээ: A 100,000₮ → Black Friday 80,000₮; бэлэн багц
   * гишүүдийн үндсэн нийлбэр 200,000₮ − 5% = 190,000₮; купон 10%; V point
   * 10,000₮; хүргэлт 7,000₮. Купон хямдралын ДАРААХ дүнгээс (validate_coupon:
   * floor(270,000 × 10 / 100) = 27,000₮) → QPay 240,000₮.
   */
  const subtotal = 80_000 + 190_000;
  const coupon = Math.floor((subtotal * 10) / 100);
  const example = {
    subtotal,
    grossSubtotal: 80_000 + 200_000,
    saleBreakdown: [{ label: "Black Friday", amount: 20_000 }],
    discount: coupon,
    couponCode: "VS10",
    loyaltyUsed: 10_000,
    shippingFee: 7_000,
  };
  const total = subtotal - coupon - 10_000 + 7_000;

  it("§1 жишээ: мөр бүр ба дараалал", () => {
    expect(coupon).toBe(27_000);
    expect(total).toBe(240_000);
    expect(orderSummaryRows(example).map((r) => [r.label, r.value])).toEqual([
      ["Нийт үндсэн үнэ", "300,000₮"],
      ["Багцын хямдрал", "−10,000₮"],
      ["Black Friday", "−20,000₮"],
      ["Нийт барааны үнэ", "270,000₮"],
      ["Купон · VS10", "−27,000₮"],
      ["V point", "−10,000₮"],
      ["Хүргэлт", "+7,000₮"],
    ]);
    expect(signedSum(orderSummaryRows(example))).toBe(total);
  });

  it("хувийн купон + арга хэмжээ: мөрүүдийн нийлбэр = эцсийн дүн", () => {
    // 2 × 45,000₮ (үндсэн 50,000₮, «Цагаан сар» −10%) + гар хямдрал 30,000→27,000.
    const sub = 2 * 45_000 + 27_000;
    const pct = Math.floor((sub * 15) / 100); // 15% купон
    const o = {
      subtotal: sub,
      grossSubtotal: sub,
      saleBreakdown: [
        { label: "Цагаан сар", amount: 10_000 },
        { label: "Хямдрал", amount: 3_000 },
      ],
      discount: pct,
      couponCode: "P15",
      loyaltyUsed: 0,
      shippingFee: 8_000,
    };
    const rows = orderSummaryRows(o);
    expect(rows[0]).toMatchObject({ value: "130,000₮" });
    expect(rows.map((r) => r.label)).toEqual([
      "Нийт үндсэн үнэ",
      "Цагаан сар",
      "Хямдрал",
      "Нийт барааны үнэ",
      "Купон · P15",
      "Хүргэлт",
    ]);
    expect(signedSum(rows)).toBe(sub - pct + 8_000);
  });

  it("мөнгөн купон + арга хэмжээ: мөрүүдийн нийлбэр = эцсийн дүн", () => {
    const o = {
      subtotal: 80_000,
      grossSubtotal: 80_000,
      saleBreakdown: [{ label: "Black Friday", amount: 20_000 }],
      discount: 5_000,
      couponCode: "VW5K",
      loyaltyUsed: 3_000,
      shippingFee: 7_000,
    };
    const rows = orderSummaryRows(o);
    expect(rows[0]).toMatchObject({ value: "100,000₮" });
    expect(signedSum(rows)).toBe(80_000 - 5_000 - 3_000 + 7_000);
  });

  it("хуучин захиалга (sale_breakdown = null) өмнөх шигээ", () => {
    expect(
      labels({ ...base, saleBreakdown: null, grossSubtotal: 100_000 }),
    ).toEqual(["Барааны дүн", "Хүргэлт"]);
  });

  it("хүргэлтийн мөрийг орхиж болно (checkout өөрөө зурна)", () => {
    expect(
      orderSummaryRows(base, { shipping: false }).map((r) => r.label),
    ).toEqual(["Барааны дүн"]);
  });
});

describe("§5 жишээ — арга хэмжээнд орсон багц (16.7)", () => {
  it("туг нээлттэй: 100,000 → −5,000 багц → −5,000 Black Friday → −9,000 купон → −5,000 V point → +6,000", () => {
    const rows = orderSummaryRows({
      subtotal: 90000,
      grossSubtotal: 95000,
      saleBreakdown: [{ label: "Black Friday", amount: 5000 }],
      discount: 9000,
      couponCode: "BF10",
      loyaltyUsed: 5000,
      shippingFee: 6000,
    });
    expect(rows.map((r) => [r.label, r.value])).toEqual([
      ["Нийт үндсэн үнэ", formatPrice(100000)],
      ["Багцын хямдрал", `−${formatPrice(5000)}`],
      ["Black Friday", `−${formatPrice(5000)}`],
      ["Нийт барааны үнэ", formatPrice(90000)],
      ["Купон · BF10", `−${formatPrice(9000)}`],
      ["V point", `−${formatPrice(5000)}`],
      ["Хүргэлт", `+${formatPrice(6000)}`],
    ]);
  });

  it("туг хаалттай: өмнөх шиг — Black Friday мөргүй, купон 9,500", () => {
    const rows = orderSummaryRows({
      subtotal: 95000,
      grossSubtotal: 100000,
      saleBreakdown: [],
      discount: 9500,
      couponCode: "BF10",
      loyaltyUsed: 5000,
      shippingFee: 6000,
    });
    expect(rows.map((r) => r.label)).toEqual([
      "Нийт үндсэн үнэ",
      "Багцын хямдрал",
      "Нийт барааны үнэ",
      "Купон · BF10",
      "V point",
      "Хүргэлт",
    ]);
    expect(rows[2].value).toBe(formatPrice(95000));
  });
});

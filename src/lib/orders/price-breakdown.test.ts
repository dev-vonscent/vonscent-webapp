import { describe, expect, it } from "vitest";
import {
  MANUAL_SALE_LABEL,
  parseSaleBreakdown,
  saleBreakdownOf,
  saleTotalOf,
} from "./price-breakdown";

describe("saleBreakdownOf", () => {
  it("арга хэмжээ нэрээрээ, гар хямдрал нэг «Хямдрал» мөр болж, сүүлд", () => {
    const rows = saleBreakdownOf([
      // гар хямдрал (нэртэй хямдралын нэр энд ирдэггүй)
      { unitPrice: 27_000, basePrice: 30_000, saleLabel: null, qty: 1 },
      { unitPrice: 15_300, basePrice: 18_000, saleLabel: null, qty: 2 },
      // арга хэмжээ
      {
        unitPrice: 80_000,
        basePrice: 100_000,
        saleLabel: "Black Friday",
        qty: 1,
      },
      { unitPrice: 45_000, basePrice: 50_000, saleLabel: "Цагаан сар", qty: 1 },
      // хямдралгүй, үндсэн үнэ мэдэгдэхгүй
      { unitPrice: 40_000, basePrice: 40_000, qty: 3 },
      { unitPrice: 40_000, qty: 1 },
    ]);
    expect(rows).toEqual([
      { label: "Black Friday", amount: 20_000 },
      { label: "Цагаан сар", amount: 5_000 },
      { label: MANUAL_SALE_LABEL, amount: 3_000 + 2 * 2_700 },
    ]);
    expect(saleTotalOf(rows)).toBe(33_400);
  });

  it("parseSaleBreakdown: хуучин захиалга null, эвдэрсэн мөр алгасна", () => {
    expect(parseSaleBreakdown(null)).toBeNull();
    expect(
      parseSaleBreakdown([
        { label: "Black Friday", amount: 13_700 },
        { label: 5, amount: 1 },
        { label: "x", amount: 0 },
      ]),
    ).toEqual([{ label: "Black Friday", amount: 13_700 }]);
  });
});

describe("арга хэмжээнд орсон бэлэн багц (16.7) — checkout-ийн задаргаа", () => {
  it("багцын event хэсэг барааны ижил event-ийн мөртэй нийлнэ (SQL-тэй ижил)", () => {
    // Дан бараа 25,000 → Black Friday 20,000; багц 90,000 (event хэсэг 5,000).
    const rows = saleBreakdownOf([
      { unitPrice: 20000, basePrice: 25000, qty: 1, saleLabel: "Black Friday" },
      { unitPrice: 90000, basePrice: 95000, qty: 1, saleLabel: "Black Friday" },
    ]);
    expect(rows).toEqual([{ label: "Black Friday", amount: 10000 }]);
  });

  it("event-гүй багц (saleAmount 0) задаргаанд орохгүй", () => {
    expect(
      saleBreakdownOf([
        { unitPrice: 95000, basePrice: 95000, qty: 2, saleLabel: null },
      ]),
    ).toEqual([]);
  });
});

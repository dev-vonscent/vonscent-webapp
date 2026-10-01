import { describe, expect, it } from "vitest";
import {
  EMPTY_FINANCE,
  financeFromRow,
  financeLines,
  type ReportFinance,
} from "./report-finance";

/** SQL (0111) ижил томьёогоор бодсон мэт жишээ. */
function sample(): ReportFinance {
  const goods = 1_000_000;
  const coupon = 50_000;
  const points = 20_000;
  const refunds = 90_000;
  const netSales = goods - coupon - points - refunds;
  const qpayFee = 9_350;
  const refundFee = 900;
  const purchases = 400_000;
  return {
    ...EMPTY_FINANCE,
    goods,
    coupon,
    points,
    refunds,
    netSales,
    shipping: 35_000,
    qpayFee,
    refundFee,
    purchases,
    profit: netSales - qpayFee + refundFee - purchases,
  };
}

describe("financeLines", () => {
  it("дэд дүн бүр дээрх мөрүүдийн нийлбэр", () => {
    let running = 0;
    for (const line of financeLines(sample())) {
      if (line.total) {
        expect(line.amount).toBe(running);
      } else {
        running += line.amount;
      }
    }
  });

  it("хүргэлт задаргаанд орохгүй (дамжин өнгөрөх мөнгө)", () => {
    const f = sample();
    const withShipping = financeLines({ ...f, shipping: 999_999 });
    expect(withShipping).toEqual(financeLines(f));
  });

  it("цэвэр борлуулалт ба ашгийг тэр чигээр нь харуулна", () => {
    const lines = financeLines(sample());
    expect(lines.find((l) => l.label === "Цэвэр борлуулалт")?.amount).toBe(
      840_000,
    );
    expect(lines.find((l) => l.label === "Ашиг")?.amount).toBe(431_550);
  });
});

describe("financeFromRow", () => {
  it("bigint-ийг string-ээр ирсэн ч number болгоно", () => {
    const f = financeFromRow({
      goods: "100" as unknown as number,
      coupon: 0,
      points: 0,
      refunds: 0,
      net_sales: 100,
      shipping: 0,
      qpay_fee: 1,
      refund_fee: 0,
      purchases: 0,
      profit: 99,
      sale_orders: 1,
      refund_orders: 0,
      pending_refund_orders: 0,
      pending_refund_amount: 0,
    });
    expect(f.goods).toBe(100);
    expect(f.profit).toBe(99);
  });
});

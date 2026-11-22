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

  it("бэлгийн картыг тусдаа мөр болгоно, цэвэр борлуулалт өөрчлөгдөхгүй", () => {
    const f = { ...sample(), giftCardGoods: 200_000 };
    const lines = financeLines(f);
    expect(lines[0]).toEqual({ label: "Барааны нийт дүн", amount: 800_000 });
    expect(lines[1]).toEqual({ label: "Бэлгийн карт", amount: 200_000 });
    expect(lines.find((l) => l.label === "Цэвэр борлуулалт")?.amount).toBe(840_000);
    let running = 0;
    for (const line of lines) {
      if (line.total) expect(line.amount).toBe(running);
      else running += line.amount;
    }
  });

  it("карт зарагдаагүй бол «Бэлгийн карт» мөр гарахгүй", () => {
    expect(financeLines(sample()).some((l) => l.label === "Бэлгийн карт")).toBe(false);
  });
});

describe("plan §7.1 жишээ: карт 11-р сард, оноогоор 12-р сард", () => {
  it("хоёр сарын цэвэр борлуулалтын нийлбэр = дансанд орсон мөнгө", () => {
    // 11-р сар: 100,000₮ карт зарагдав.
    const nov = { ...EMPTY_FINANCE, goods: 100_000, giftCardGoods: 100_000, netSales: 100_000 };
    // 12-р сар: 120,000₮ үнэртэн — 100,000 оноогоор, 20,000 QPay.
    const dec = { ...EMPTY_FINANCE, goods: 120_000, points: 100_000, netSales: 20_000 };
    const net = (f: ReportFinance) =>
      financeLines(f).find((l) => l.label === "Цэвэр борлуулалт")!.amount;
    expect(net(nov) + net(dec)).toBe(120_000);
  });
});

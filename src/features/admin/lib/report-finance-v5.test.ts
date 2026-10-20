import { describe, expect, it } from "vitest";
import { financeFromRow, type FinanceRow } from "./report-finance";

const base: FinanceRow = {
  goods: 100,
  coupon: 0,
  points: 0,
  refunds: 0,
  net_sales: 100,
  shipping: 0,
  qpay_fee: 1,
  refund_fee: 0,
  purchases: 60,
  profit: 39,
  sale_orders: 1,
  refund_orders: 0,
  pending_refund_orders: 0,
  pending_refund_amount: 0,
};

describe("financeFromRow — худалдан авалтын задаргаа (0156)", () => {
  it("гурван эхийг уншина", () => {
    const f = financeFromRow({
      ...base,
      perfume_purchases: 30,
      extras_purchases: 20,
      vial_purchases: 10,
    });
    expect(f).toMatchObject({
      purchases: 60,
      perfumePurchases: 30,
      extrasPurchases: 20,
      vialPurchases: 10,
    });
  });
  it("0156-аас өмнөх сан — бүгд үнэртнийх", () => {
    expect(financeFromRow(base)).toMatchObject({
      perfumePurchases: 60,
      extrasPurchases: 0,
      vialPurchases: 0,
    });
  });
});

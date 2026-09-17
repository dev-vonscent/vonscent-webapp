import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Захиалга цуцлагдахад QPay-ийн invoice-ыг ч хаах.
 *
 * Хамгийн чухал хамгаалалт нь **төлөгдсөн invoice-ыг бүү хүр**: мөнгө аль
 * хэдийн орсон бол энэ нь буцаалтын асуудал болохоос invoice-ийн асуудал
 * биш, харин цуцлах оролдлого нь QPay дээр ойлгомжгүй төлөв үүсгэж болзошгүй.
 */

const cancelInvoice = vi.fn(async () => true);
let row: { qpay_invoice_id: string | null; payment_status: string } | null =
  null;

vi.mock("./qpay", () => ({ cancelInvoice }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: row }) }),
      }),
    }),
  }),
}));

const { cancelOrderInvoice } = await import("./cancel-invoice");

beforeEach(() => {
  cancelInvoice.mockClear();
  row = null;
});

describe("cancelOrderInvoice", () => {
  it("cancels the invoice of an unpaid order", async () => {
    row = { qpay_invoice_id: "inv_1", payment_status: "unpaid" };
    await cancelOrderInvoice("o1");
    expect(cancelInvoice).toHaveBeenCalledWith("inv_1");
  });

  it("never touches a paid invoice — that is a refund problem, not an invoice one", async () => {
    row = { qpay_invoice_id: "inv_1", payment_status: "paid" };
    await cancelOrderInvoice("o1");
    expect(cancelInvoice).not.toHaveBeenCalled();
  });

  it("leaves a refunded order alone too", async () => {
    row = { qpay_invoice_id: "inv_1", payment_status: "refunded" };
    await cancelOrderInvoice("o1");
    expect(cancelInvoice).not.toHaveBeenCalled();
  });

  it("does nothing when the order has no invoice", async () => {
    row = { qpay_invoice_id: null, payment_status: "unpaid" };
    await cancelOrderInvoice("o1");
    expect(cancelInvoice).not.toHaveBeenCalled();
  });

  it("does nothing for an order that does not exist", async () => {
    row = null;
    await cancelOrderInvoice("missing");
    expect(cancelInvoice).not.toHaveBeenCalled();
  });

  it("swallows a QPay failure — the cancellation itself already happened", async () => {
    row = { qpay_invoice_id: "inv_1", payment_status: "unpaid" };
    cancelInvoice.mockResolvedValueOnce(false);
    await expect(cancelOrderInvoice("o1")).resolves.toBeUndefined();
  });
});

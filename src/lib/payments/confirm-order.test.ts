import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Төлбөр батлагдахад нүүрийн «Шилдэг худалдан авагчид»-ын кэш цэвэрлэгдэнэ
 * (тэр нь зөвхөн төлөгдсөн захиалгыг тоолдог). Зөвхөн leaderboard tag —
 * үлдэгдэл, хуудас хөндөгдөхгүй.
 */

const revalidatePath = vi.fn();
const revalidateTag = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...a: unknown[]) => revalidatePath(...a),
  revalidateTag: (...a: unknown[]) => revalidateTag(...a),
}));
vi.mock("server-only", () => ({}));

const callRpc = vi.fn();
vi.mock("@/lib/supabase/rpc", () => ({
  callRpc: (...a: unknown[]) => callRpc(...a),
}));
vi.mock("@/lib/notify/telegram", () => ({
  notifyAdmin: async () => {},
  tgEscape: (s: string) => s,
}));
vi.mock("@/lib/notify/customer-email", () => ({
  sendOrderCustomerEmail: async () => {},
}));
vi.mock("@/lib/meta/capi", () => ({ reportPurchase: async () => {} }));
const checkPayment = vi.fn();
vi.mock("@/lib/payments/qpay", () => ({
  checkPayment: (...a: unknown[]) => checkPayment(...a),
}));
vi.mock("@/lib/payments/invoice", () => ({
  readInvoice: async () => ({ amount: 50_000 }),
}));

let order: Record<string, unknown> | null = null;
/** Эхний `maybeSingle` нь захиалгыг уншина; дараагийнх (Telegram-ийн
 * дэлгэрэнгүй) хоосон — дохио товч хувилбараар явна. */
let reads = 0;
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      const chain: Record<string, unknown> = {};
      Object.assign(chain, {
        select: () => chain,
        eq: () => chain,
        insert: async () => ({ error: null }),
        upsert: async () => ({ error: null }),
        maybeSingle: async () => ({ data: reads++ === 0 ? order : null }),
      });
      return chain;
    },
  }),
}));

const { markOrderPaid, verifyAndMarkOrderPaid } = await import(
  "./confirm-order"
);
const { CACHE_TAG_LEADERBOARD } = await import("@/lib/cache-tags");

beforeEach(() => {
  reads = 0;
  order = {
    id: "o1",
    order_no: "V-1",
    payment_status: "unpaid",
    qpay_invoice_id: "inv-1",
    total: 50_000,
  };
  revalidatePath.mockReset();
  revalidateTag.mockReset();
  callRpc.mockReset().mockResolvedValue({ data: null, error: null });
  checkPayment
    .mockReset()
    .mockResolvedValue({ paid: true, paidAmount: 50_000, rows: [] });
});

describe("төлбөр батлагдахад leaderboard", () => {
  it("QPay-ээр батлагдвал (callback, reconcile, poller) зөвхөн leaderboard tag", async () => {
    expect(await verifyAndMarkOrderPaid("o1")).toEqual({ ok: true });
    expect(revalidateTag.mock.calls).toEqual([[CACHE_TAG_LEADERBOARD, "max"]]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("итгэлтэй дуудагч (mock confirm) — мөн адил", async () => {
    expect(await markOrderPaid("o1", "mock")).toEqual({ ok: true });
    expect(revalidateTag.mock.calls).toEqual([[CACHE_TAG_LEADERBOARD, "max"]]);
  });

  it("аль хэдийн төлөгдсөн бол цэвэрлэхгүй — poller давтагдах бүрт нүүр бичигдэхгүй", async () => {
    order = { ...order, payment_status: "paid" };
    expect(await verifyAndMarkOrderPaid("o1")).toEqual({
      ok: true,
      alreadyPaid: true,
    });
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("төлөгдөөгүй эсвэл commit унасан бол цэвэрлэхгүй", async () => {
    checkPayment.mockResolvedValueOnce({ paid: false, paidAmount: 0, rows: [] });
    expect(await verifyAndMarkOrderPaid("o1")).toEqual({
      ok: false,
      error: "NOT_PAID",
    });
    reads = 0;
    callRpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    expect(await verifyAndMarkOrderPaid("o1")).toEqual({
      ok: false,
      error: "COMMIT_FAILED",
    });
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});

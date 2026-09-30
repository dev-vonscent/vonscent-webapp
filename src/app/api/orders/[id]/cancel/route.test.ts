import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Хэрэглэгч захиалгаа цуцлах (клиент, 2026-09-30): төлсөн захиалгад
 * буцаалтын данс ЗААВАЛ, бөгөөд цуцлахаас ӨМНӨ хадгалагдана — хадгалж
 * чадаагүй бол цуцлалт хийгдэхгүй.
 */

let user: { id: string } | null = { id: "u1" };
let order: Record<string, unknown> | null = null;
const callRpc = vi.fn();
const upsert = vi.fn();
/** Үйлдлүүдийн дараалал — данс цуцлалтаас өмнө бичигдэж буйг шалгана. */
const steps: string[] = [];

vi.mock("@/lib/env", () => ({
  isSupabaseConfigured: true,
  env: { siteUrl: "http://test" },
}));
vi.mock("@/lib/time", async (orig) => ({
  ...(await orig<typeof import("@/lib/time")>()),
  isOrderEditable: () => true,
}));
vi.mock("@/lib/cache", () => ({ revalidatePublic: () => {} }));
vi.mock("@/lib/payments/cancel-invoice", () => ({
  cancelOrderInvoice: async () => {},
}));
vi.mock("@/lib/email", () => ({
  sendEmail: async () => {},
  STORE_INBOX: "store@test",
  renderEmail: () => ({ html: "", text: "" }),
}));
vi.mock("@/lib/notify/customer-email", () => ({
  sendOrderCustomerEmail: async () => {},
}));
vi.mock("@/lib/supabase/rpc", () => ({
  callRpc: (...args: unknown[]) => {
    steps.push("cancel");
    return callRpc(...args);
  },
}));

/** `.select().eq().maybeSingle()` → `order`. */
function orderQuery() {
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.maybeSingle = async () => ({ data: order });
  return chain;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user } }) },
    from: () => orderQuery(),
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) =>
      table === "order_refund_accounts"
        ? {
            upsert: async (row: unknown) => {
              steps.push("account");
              return upsert(row);
            },
          }
        : orderQuery(),
  }),
}));

const { POST } = await import("./route");

function cancel(body?: unknown) {
  return POST(
    new Request("http://test/api/orders/o1/cancel", {
      method: "POST",
      ...(body !== undefined && {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    }),
    { params: Promise.resolve({ id: "o1" }) },
  );
}

const ACCOUNT = {
  bank: "Хаан банк",
  accountNumber: "5000 1234 5678",
  holderName: "Сараа",
};

beforeEach(() => {
  user = { id: "u1" };
  order = {
    id: "o1",
    user_id: "u1",
    status: "confirmed",
    payment_status: "paid",
    created_at: "2026-09-30T00:00:00Z",
    deliver_on: "2026-10-01",
    order_no: "V-1",
    total: 100_000,
  };
  steps.length = 0;
  callRpc.mockReset().mockResolvedValue({ data: null, error: null });
  upsert.mockReset().mockResolvedValue({ error: null });
});

describe("POST /api/orders/[id]/cancel", () => {
  it("refuses a paid order without a refund account, touching nothing", async () => {
    const res = await cancel();
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "REFUND_ACCOUNT_REQUIRED" });
    expect(steps).toEqual([]);
  });

  it("rejects a malformed account before looking further", async () => {
    const res = await cancel({
      refundAccount: { ...ACCOUNT, accountNumber: "12" },
    });
    expect(res.status).toBe(400);
    expect(steps).toEqual([]);
  });

  it("saves the normalised account, then cancels", async () => {
    const res = await cancel({ refundAccount: ACCOUNT });
    expect(res.status).toBe(200);
    expect(steps).toEqual(["account", "cancel"]);
    expect(upsert).toHaveBeenCalledWith({
      order_id: "o1",
      bank: "Хаан банк",
      account_number: "500012345678",
      holder_name: "Сараа",
    });
  });

  it("does not cancel when the account could not be saved", async () => {
    upsert.mockResolvedValue({ error: { message: "boom" } });
    const res = await cancel({ refundAccount: ACCOUNT });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "REFUND_ACCOUNT_FAILED" });
    expect(callRpc).not.toHaveBeenCalled();
  });

  it("cancels an unpaid order with no account and no body", async () => {
    order = { ...order, payment_status: "unpaid" };
    const res = await cancel();
    expect(res.status).toBe(200);
    expect(steps).toEqual(["cancel"]);
  });

  it("still refuses someone else's order", async () => {
    user = { id: "u2" };
    const res = await cancel({ refundAccount: ACCOUNT });
    expect(res.status).toBe(404);
    expect(steps).toEqual([]);
  });
});

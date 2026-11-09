import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Хэрэглэгч захиалгаа цуцлах: зөвхөн ТӨЛӨӨГҮЙ захиалга (клиент,
 * 2026-10-26). Төлсөн захиалгыг хэрэглэгч цуцлахгүй — пэйж чат/утсаар
 * админ цуцална.
 */

let user: { id: string } | null = { id: "u1" };
let order: Record<string, unknown> | null = null;
const callRpc = vi.fn();
const sendEmail = vi.fn();

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
  sendEmail: (...args: unknown[]) => sendEmail(...args),
  STORE_INBOX: "store@test",
  renderEmail: () => ({ html: "", text: "" }),
}));
vi.mock("@/lib/notify/customer-email", () => ({
  sendOrderCustomerEmail: async () => {},
}));
vi.mock("@/lib/supabase/rpc", () => ({
  callRpc: (...args: unknown[]) => callRpc(...args),
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
  createAdminClient: () => ({ from: () => orderQuery() }),
}));

const { POST } = await import("./route");

function cancel() {
  return POST(
    new Request("http://test/api/orders/o1/cancel", { method: "POST" }),
    { params: Promise.resolve({ id: "o1" }) },
  );
}

beforeEach(() => {
  user = { id: "u1" };
  order = {
    id: "o1",
    user_id: "u1",
    status: "confirmed",
    payment_status: "unpaid",
    created_at: "2026-09-30T00:00:00Z",
    deliver_on: "2026-10-01",
    order_no: "V-1",
    total: 100_000,
  };
  callRpc.mockReset().mockResolvedValue({ data: null, error: null });
  sendEmail.mockReset().mockResolvedValue(undefined);
});

describe("POST /api/orders/[id]/cancel", () => {
  it("cancels an unpaid order", async () => {
    const res = await cancel();
    expect(res.status).toBe(200);
    expect(callRpc).toHaveBeenCalledOnce();
    expect(sendEmail).toHaveBeenCalledOnce();
  });

  it("refuses a paid order, touching nothing", async () => {
    order = { ...order, payment_status: "paid" };
    const res = await cancel();
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "PAID_NOT_CANCELLABLE" });
    expect(callRpc).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("still refuses someone else's order", async () => {
    user = { id: "u2" };
    const res = await cancel();
    expect(res.status).toBe(404);
    expect(callRpc).not.toHaveBeenCalled();
  });

  it("refuses an order that is already on its way", async () => {
    order = { ...order, status: "shipping" };
    const res = await cancel();
    expect(res.status).toBe(409);
    expect(callRpc).not.toHaveBeenCalled();
  });

  it("emails nobody when the cancel failed", async () => {
    callRpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    const res = await cancel();
    expect(res.status).toBe(500);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

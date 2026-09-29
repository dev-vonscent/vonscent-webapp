import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Купоны хоёр нийтийн route-ийн хаалга (0104):
 * - зочин купон шалгаж, санал авч чадахгүй;
 * - санал болгох жагсаалтад ЗӨВХӨН тухайн хэрэглэгчийн хувийн купон орно —
 *   нийтийн купон (`user_id` null) кодоор л ажиллана.
 */

let user: { id: string } | null = null;
const callRpc = vi.fn();
/** Every filter the available route put on its coupons query. */
const calls: [string, unknown[]][] = [];
let rows: unknown[] = [];

vi.mock("@/lib/env", () => ({ isSupabaseConfigured: true }));
vi.mock("@/lib/rate-limit", () => ({ enforceRateLimit: async () => null }));
vi.mock("@/lib/supabase/rpc", () => ({
  callRpc: (...args: unknown[]) => callRpc(...args),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user } }) },
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      const chain: Record<string, unknown> = {};
      for (const m of ["select", "eq", "or", "is", "order", "limit"]) {
        chain[m] = (...args: unknown[]) => {
          calls.push([m, args]);
          return chain;
        };
      }
      chain.then = (resolve: (v: unknown) => unknown) =>
        resolve({ data: rows });
      return chain;
    },
  }),
}));

const validate = await import("./validate/route");
const available = await import("./available/route");

function post(body: unknown) {
  return new Request("http://test/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  user = null;
  rows = [];
  calls.length = 0;
  callRpc.mockReset();
});

describe("POST /api/coupons/validate", () => {
  it("refuses a guest before looking the code up", async () => {
    const res = await validate.POST(
      post({ code: "WELCOME11", subtotal: 50000 }),
    );
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data).toMatchObject({ valid: false, reason: "LOGIN_REQUIRED" });
    expect(callRpc).not.toHaveBeenCalled();
  });

  it("names the minimum when the cart is below it", async () => {
    user = { id: "u1" };
    callRpc.mockResolvedValue({
      data: {
        valid: false,
        discount: 0,
        reason: "MIN_SUBTOTAL",
        minSubtotal: 100000,
      },
    });
    const res = await validate.POST(post({ code: "MIN100", subtotal: 60000 }));
    expect((await res.json()).message).toBe(
      "Энэ купон 100,000₮-өөс дээш захиалгад хэрэглэгдэнэ.",
    );
  });

  it("validates a signed-in customer's code against their own id", async () => {
    user = { id: "u-friend" };
    callRpc.mockResolvedValue({
      data: { valid: true, discount: 5000, code: "VS-ABCDEF" },
    });
    const res = await validate.POST(
      post({ code: "vs-abcdef", subtotal: 50000 }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ valid: true, discount: 5000 });
    expect(callRpc).toHaveBeenCalledWith(
      expect.anything(),
      "validate_coupon",
      expect.objectContaining({ p_user: "u-friend" }),
    );
  });
});

describe("POST /api/coupons/available", () => {
  it("offers a guest nothing", async () => {
    const res = await available.POST(post({ subtotal: 50000 }));
    expect(await res.json()).toEqual({ coupons: [] });
    expect(calls).toHaveLength(0);
  });

  it("lists only coupons issued to this customer — never public ones", async () => {
    user = { id: "u1" };
    await available.POST(post({ subtotal: 50000 }));
    expect(calls).toContainEqual(["eq", ["user_id", "u1"]]);
    // The old query was `or(user_id.is.null, …)`: public codes leaked into
    // every customer's suggestions.
    expect(calls.some(([m]) => m === "or")).toBe(false);
    expect(calls.some(([m, a]) => m === "is" && a[0] === "user_id")).toBe(
      false,
    );
  });

  it("keeps identical coupons as separate offers, soonest expiry first", async () => {
    user = { id: "u1" };
    const base = {
      type: "percent",
      value: 10,
      min_subtotal: 0,
      max_discount: null,
      user_id: "u1",
    };
    rows = [
      { ...base, id: "a", code: "LATE", ends_at: "2026-12-01T00:00:00Z" },
      { ...base, id: "b", code: "SOON", ends_at: "2026-10-05T00:00:00Z" },
    ];
    callRpc.mockResolvedValue({ data: { valid: true, discount: 5000 } });
    const res = await available.POST(post({ subtotal: 50000 }));
    const { coupons } = await res.json();
    expect(coupons.map((c: { code: string }) => c.code)).toEqual([
      "SOON",
      "LATE",
    ]);
  });

  it("lists a coupon below its minimum as not yet usable, with the shortfall", async () => {
    user = { id: "u1" };
    rows = [
      {
        id: "m",
        code: "MIN100",
        type: "fixed",
        value: 10000,
        min_subtotal: 100000,
        max_discount: null,
        ends_at: null,
        user_id: "u1",
      },
    ];
    callRpc.mockResolvedValue({
      data: { valid: false, discount: 0, reason: "MIN_SUBTOTAL" },
    });
    const res = await available.POST(post({ subtotal: 60000 }));
    const { coupons } = await res.json();
    expect(coupons).toEqual([
      expect.objectContaining({
        code: "MIN100",
        eligible: false,
        shortfall: 40000,
        discount: 0,
        minSubtotal: 100000,
      }),
    ]);
  });

  it("still drops coupons that fail for any other reason", async () => {
    user = { id: "u1" };
    rows = [
      {
        id: "x",
        code: "GONE",
        type: "fixed",
        value: 1,
        min_subtotal: 0,
        max_discount: null,
        ends_at: null,
        user_id: "u1",
      },
    ];
    callRpc.mockResolvedValue({
      data: { valid: false, discount: 0, reason: "MAX_USES" },
    });
    const res = await available.POST(post({ subtotal: 60000 }));
    expect((await res.json()).coupons).toEqual([]);
  });
});

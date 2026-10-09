import { afterAll, beforeAll, describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { loadWallet } = await import("./wallet-server");

/**
 * Хуваалцсан купоны эзэмшигч хэн ашигласныг хардаг ч найзынх нь id, бүтэн
 * нэр, утас хэзээ ч client руу явахгүй (0104).
 */

const OWNER = "owner-1";
const FRIEND = "friend-9";

const TABLES: Record<string, unknown[]> = {
  coupons: [
    {
      id: "c1",
      code: "VS-SHARED",
      type: "percent",
      value: 10,
      min_subtotal: 0,
      max_discount: null,
      ends_at: "2026-12-01T00:00:00Z",
      max_uses: 1,
      used_count: 1,
      is_active: true,
      source: "manual",
    },
    {
      // Used long ago — the list forgets it, the detail page does not.
      id: "c3",
      code: "VS-OLD",
      type: "fixed",
      value: 5000,
      min_subtotal: 0,
      max_discount: null,
      ends_at: null,
      max_uses: 1,
      used_count: 1,
      is_active: true,
      source: "manual",
    },
    {
      id: "c2",
      code: "VS-MINE",
      type: "fixed",
      value: 5000,
      min_subtotal: 0,
      max_discount: null,
      ends_at: null,
      max_uses: 1,
      used_count: 1,
      is_active: true,
      source: "manual",
    },
  ],
  coupon_redemptions: [
    { coupon_id: "c1", user_id: FRIEND, created_at: "2026-09-28T04:00:00Z" },
    { coupon_id: "c2", user_id: OWNER, created_at: "2026-09-20T04:00:00Z" },
    { coupon_id: "c3", user_id: OWNER, created_at: "2026-08-01T04:00:00Z" },
  ],
  profiles: [{ id: FRIEND, full_name: "Болормаа", phone: "99112233" }],
};

const filters: [string, string, unknown][] = [];
function fakeAdmin() {
  return {
    from: (table: string) => {
      const chain: Record<string, unknown> = {};
      for (const m of ["select", "eq", "in", "is", "order", "limit"]) {
        chain[m] = (...args: unknown[]) => {
          filters.push([table, m, args]);
          return chain;
        };
      }
      chain.then = (resolve: (v: unknown) => unknown) =>
        resolve({ data: TABLES[table] });
      return chain;
    },
  } as never;
}

describe("loadWallet", () => {
  // Fixed clock: the 30-day history window would otherwise make these rows
  // drop out of the list as real time passes.
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-01T00:00:00Z"));
  });
  afterAll(() => vi.useRealTimers());

  it("hides coupons used more than 30 days ago from the list only", async () => {
    const list = await loadWallet(fakeAdmin(), OWNER);
    expect(list.map((c) => c.code)).not.toContain("VS-OLD");
    expect(list.map((c) => c.code)).toContain("VS-MINE");
    // The detail page (by code) still opens it.
    const byCode = await loadWallet(fakeAdmin(), OWNER, "vs-old");
    expect(byCode.map((c) => c.code)).toContain("VS-OLD");
  });

  it("masks a friend who used a shared coupon", async () => {
    const wallet = await loadWallet(fakeAdmin(), OWNER);
    const shared = wallet.find((c) => c.code === "VS-SHARED")!;
    expect(shared.status).toBe("used");
    expect(shared.redemptions).toEqual([
      { by: { name: "Б***", phone: "••2233" }, at: "2026-09-28T04:00:00Z" },
    ]);

    const raw = JSON.stringify(wallet);
    expect(raw).not.toContain(FRIEND);
    expect(raw).not.toContain("Болормаа");
    expect(raw).not.toContain("99112233");
  });

  it("says «self» when the owner used it", async () => {
    const wallet = await loadWallet(fakeAdmin(), OWNER);
    expect(wallet.find((c) => c.code === "VS-MINE")!.redemptions[0].by).toBe(
      "self",
    );
  });

  it("scopes the query to the owner and ignores cancelled uses", async () => {
    filters.length = 0;
    await loadWallet(fakeAdmin(), OWNER, "vs-mine");
    expect(filters).toContainEqual(["coupons", "eq", ["user_id", OWNER]]);
    expect(filters).toContainEqual(["coupons", "eq", ["code", "VS-MINE"]]);
    expect(filters).toContainEqual([
      "coupon_redemptions",
      "is",
      ["cancelled_at", null],
    ]);
  });
});

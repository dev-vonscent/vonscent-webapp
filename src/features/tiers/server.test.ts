import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Олон хэрэглэгчийн түвшин (`getTiersForUsers`) ба нүүр хуудасны топ —
 * сэтгэгдэл, Top 3 хэсэгт ашиглагдана.
 */

let flagOn = true;
let orders: Record<string, unknown>[] = [];
const filters: [string, unknown[]][] = [];
const callRpc = vi.fn();

vi.mock("@/lib/env", () => ({ isSupabaseConfigured: true }));
vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: async () => flagOn,
}));
vi.mock("next/cache", () => ({
  unstable_cache: <T>(fn: T) => fn,
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => null }));
vi.mock("@/lib/supabase/rpc", () => ({
  callRpc: (...args: unknown[]) => callRpc(...args),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      const chain: Record<string, unknown> = {};
      for (const m of ["select", "in", "eq", "neq"]) {
        chain[m] = (...args: unknown[]) => {
          filters.push([m, args]);
          return chain;
        };
      }
      chain.then = (resolve: (v: unknown) => unknown) =>
        resolve({ data: orders, error: null });
      return chain;
    },
  }),
}));

const { getTiersForUsers, getPublicLeaderboards } = await import("./server");

const paid = (user_id: string, subtotal: number, discount = 0) => ({
  user_id,
  payment_status: "paid",
  status: "delivered",
  subtotal,
  discount,
});

beforeEach(() => {
  flagOn = true;
  orders = [];
  filters.length = 0;
  callRpc.mockReset();
});

describe("getTiersForUsers", () => {
  it("туг хаалттай бол хоосон — сан уншихгүй", async () => {
    flagOn = false;
    expect(await getTiersForUsers(["a"])).toEqual({});
    expect(filters).toHaveLength(0);
  });

  it("хэрэглэгч бүрийн нийт дүнгээр түвшин; захиалгагүй нь Standard", async () => {
    orders = [
      paid("a", 6_000_000, 500_000),
      paid("a", 5_000_000),
      paid("b", 1_100_000, 200_000),
    ];
    expect(await getTiersForUsers(["a", "b", "c", "a"])).toEqual({
      a: "ruby", // 10.5 сая
      b: "standard", // купоны дараа 900 мянга
      c: "standard",
    });
    // Зөвхөн төлөгдсөн, цуцлагдаагүй — давхардалгүй id-аар.
    expect(filters).toContainEqual(["in", ["user_id", ["a", "b", "c"]]]);
    expect(filters).toContainEqual(["eq", ["payment_status", "paid"]]);
    expect(filters).toContainEqual(["neq", ["status", "cancelled"]]);
  });

  it("хоосон жагсаалтад сан уншихгүй", async () => {
    expect(await getTiersForUsers([])).toEqual({});
    expect(filters).toHaveLength(0);
  });
});

describe("getPublicLeaderboards", () => {
  it("хэн ч харах топ — `me`-гүй, нэр, зураг, хугацааны дүнтэй", async () => {
    callRpc.mockResolvedValue({
      data: [
        {
          rank: 1,
          full_name: "Болормаа Бат",
          avatar_url: "https://x/a.webp",
          period_spend: 2_000_000,
          lifetime_spend: 5_000_000,
          is_me: false,
        },
      ],
      error: null,
    });
    const boards = await getPublicLeaderboards();
    expect(boards?.week).toEqual({
      top: [
        {
          rank: 1,
          amount: 2_000_000,
          name: "Болормаа Бат",
          avatarUrl: "https://x/a.webp",
          tier: "sapphire",
          isMe: false,
        },
      ],
      me: null,
    });
    for (const [, , args] of callRpc.mock.calls) {
      expect(args).toMatchObject({ p_user: null });
    }
  });
});

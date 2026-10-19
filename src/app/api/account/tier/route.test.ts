import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `GET /api/account/tier` ба түүний сервер давхарга (0138, feature flag
 * `user_tiers`):
 * - туг хаалттай бол 404 — нэвтэрсэн ч юу ч уншихгүй;
 * - зочинд 401;
 * - нийт дүн → түвшин, хугацаа бүрийн топ 3 + топод ороогүй өөрийн байр.
 */

let flagOn = true;
let user: { id: string } | null = null;
const callRpc = vi.fn();
let profile: Record<string, unknown> | null = null;

vi.mock("@/lib/env", () => ({ isSupabaseConfigured: true }));
vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: async () => flagOn,
}));
vi.mock("next/cache", () => ({
  unstable_cache: <T>(fn: T) => fn,
}));
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
      for (const m of ["select", "eq"]) chain[m] = () => chain;
      chain.maybeSingle = async () => ({ data: profile });
      return chain;
    },
  }),
}));

const route = await import("./route");

async function GET() {
  const res = await route.GET();
  if (!res) throw new Error("no response");
  return res;
}

const ME = "me-1";

function row(over: Record<string, unknown>) {
  return {
    rank: 1,
    user_id: "u",
    full_name: "Болормаа Бат",
    avatar_url: null,
    period_spend: "100000",
    lifetime_spend: "100000",
    is_me: false,
    ...over,
  };
}

beforeEach(() => {
  flagOn = true;
  user = null;
  profile = { full_name: "Тэнгис", avatar_url: "https://x/me.webp" };
  callRpc.mockReset();
});

describe("GET /api/account/tier", () => {
  it("туг хаалттай бол 404, санд хүрэхгүй", async () => {
    flagOn = false;
    user = { id: ME };
    const res = await GET();
    expect(res.status).toBe(404);
    expect(callRpc).not.toHaveBeenCalled();
  });

  it("зочинд 401", async () => {
    const res = await GET();
    expect(res.status).toBe(401);
    expect(callRpc).not.toHaveBeenCalled();
  });

  it("нийт дүнгээр түвшин, хугацаа бүрийн топ ба өөрийн байр", async () => {
    user = { id: ME };
    callRpc.mockImplementation(async (_c, fn: string) => {
      if (fn === "user_lifetime_spend") return { data: "3200000", error: null };
      // Топ 3 + топод ороогүй өөрийн мөр (#5).
      return {
        data: [
          row({ rank: 1, lifetime_spend: "12000000", period_spend: "900000" }),
          row({ rank: 2, full_name: null, lifetime_spend: "1500000" }),
          row({ rank: 3, full_name: "  Сараа ", lifetime_spend: "0" }),
          row({
            rank: 5,
            user_id: ME,
            full_name: "Тэнгис",
            is_me: true,
            lifetime_spend: "3200000",
          }),
        ],
        error: null,
      };
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.lifetimeSpend).toBe(3_200_000);
    expect(body.tier).toBe("platinum");
    expect(body.me).toEqual({ name: "Тэнгис", avatarUrl: "https://x/me.webp" });

    for (const period of ["week", "month", "all"]) {
      const board = body.leaderboards[period];
      expect(board.top.map((e: { rank: number }) => e.rank)).toEqual([1, 2, 3]);
      expect(board.top[0]).toMatchObject({
        name: "Болормаа Бат",
        tier: "ruby",
        amount: 900_000,
        isMe: false,
      });
      expect(board.top[1]).toMatchObject({
        name: "vonscent гишүүн",
        tier: "gold",
      });
      expect(board.top[2]).toMatchObject({ name: "Сараа", tier: "standard" });
      expect(board.me).toMatchObject({ rank: 5, isMe: true, tier: "platinum" });
    }

    // Гурван хугацаа тус бүр өөрийн id-тай, топ 3-аар.
    const boards = callRpc.mock.calls.filter(
      (c) => c[1] === "tier_leaderboard",
    );
    expect(boards).toHaveLength(3);
    for (const [, , args] of boards) {
      expect(args).toMatchObject({ p_user: ME, p_limit: 3 });
    }
  });

  it("сангийн алдаа → 500", async () => {
    user = { id: ME };
    callRpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    const res = await GET();
    expect(res.status).toBe(500);
  });
});

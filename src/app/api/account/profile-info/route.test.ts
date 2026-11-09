import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `/api/account/profile-info` ба `/reward` (0163, feature flag `profile_info`):
 * - туг хаалттай бол 404 — body ямар ч байсан санд хүрэхгүй;
 * - зочинд 401;
 * - GET: сангийн мөрүүдийг `ProfileInfo` болгоно;
 * - PATCH: зөвхөн өөрийн мөр, өөрийн avatar, мэдэгдэх үнэрийн төрөл,
 *   давхардсан үнэртэнгүй;
 * - reward: олгосон оноог RPC-ээс л буцаана.
 */

let flagOn = true;
let user: { id: string } | null = null;
const callRpc = vi.fn();
/** table → `maybeSingle` / list-ийн хариу. */
let rows: Record<string, unknown> = {};
const updates: { table: string; row: unknown; id: unknown }[] = [];

vi.mock("server-only", () => ({}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/env", () => ({ isSupabaseConfigured: true }));
vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: async () => flagOn,
}));
vi.mock("@/lib/supabase/rpc", () => ({
  callRpc: (...args: unknown[]) => callRpc(...args),
}));
vi.mock("@/features/taxonomy/api", () => ({
  sanitizeFamilies: async (slugs: string[]) =>
    [...new Set(slugs)].filter((s) => ["woody", "floral"].includes(s)),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user } }) },
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const chain: Record<string, unknown> = {};
      let pendingUpdate: unknown;
      for (const m of ["select", "order"]) chain[m] = () => chain;
      chain.update = (row: unknown) => {
        pendingUpdate = row;
        return chain;
      };
      chain.eq = (_col: string, value: unknown) => {
        if (pendingUpdate !== undefined) {
          updates.push({ table, row: pendingUpdate, id: value });
          return Promise.resolve({ error: null });
        }
        return chain;
      };
      chain.maybeSingle = async () => ({ data: rows[table] ?? null });
      // `addresses` нь жагсаалт — `await` хийхэд шууд хариу.
      chain.then = (resolve: (v: unknown) => void) =>
        resolve({ data: rows[table] ?? [], error: null });
      return chain;
    },
  }),
}));

const route = await import("./route");
const reward = await import("./reward/route");

const ME = "me-1";

async function get() {
  const res = await route.GET();
  if (!res) throw new Error("no response");
  return res;
}

async function claim() {
  const res = await reward.POST();
  if (!res) throw new Error("no response");
  return res;
}

async function patch(body: unknown) {
  const res = await route.PATCH(
    new Request("http://x/api/account/profile-info", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  );
  if (!res) throw new Error("no response");
  return res;
}

beforeEach(() => {
  flagOn = true;
  user = { id: ME };
  rows = {};
  updates.length = 0;
  callRpc.mockReset();
});

describe("GET /api/account/profile-info", () => {
  it("туг хаалттай бол 404", async () => {
    flagOn = false;
    expect((await get()).status).toBe(404);
  });

  it("зочинд 401", async () => {
    user = null;
    expect((await get()).status).toBe(401);
  });

  it("сангийн мөрүүдийг нэгтгэнэ", async () => {
    rows = {
      profiles: {
        full_name: "Болд",
        phone: "99112233",
        phone_verified: true,
        avatar_url: null,
        gender: "male",
        birthday: "1995-04-12",
        job: "Багш",
        scent_preferences: ["woody"],
        favorite_perfumes: null,
      },
      newsletter_subscribers: { email: "bold@example.mn" },
      addresses: [
        {
          city: "Улаанбаатар",
          district: "СБД",
          detail: null,
          is_default: true,
        },
        {
          city: "Дархан",
          district: null,
          detail: "3-р хороо",
          is_default: false,
        },
      ],
      settings: { value: { profilePoints: 300 } },
      profile_rewards: null,
    };
    const res = await get();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      avatarUrl: null,
      fullName: "Болд",
      phone: "99112233",
      phoneVerified: true,
      email: "bold@example.mn",
      gender: "male",
      birthday: "1995-04-12",
      job: "Багш",
      scentPreferences: ["woody"],
      favoritePerfumes: [],
      address: { count: 2, summary: "Улаанбаатар, СБД" },
      reward: { points: 300, claimedPoints: null },
    });
  });

  it("мэдэгдэхгүй хүйсийг null болгоно, авсан урамшууллыг харуулна", async () => {
    rows = {
      profiles: { gender: "robot" },
      profile_rewards: { points: 500 },
    };
    const body = await (await get()).json();
    expect(body.gender).toBeNull();
    expect(body.reward.claimedPoints).toBe(500);
    // Тохиргоо байхгүй бол 0163-ийн seed.
    expect(body.reward.points).toBe(500);
  });
});

describe("PATCH /api/account/profile-info", () => {
  it("туг хаалттай бол буруу body-д ч 404", async () => {
    flagOn = false;
    expect((await patch({ nope: 1 })).status).toBe(404);
    expect(updates).toEqual([]);
  });

  it("зочинд 401", async () => {
    user = null;
    expect((await patch({ job: "Багш" })).status).toBe(401);
  });

  it("буруу body-г 400", async () => {
    expect((await patch({ loyaltyPoints: 999 })).status).toBe(400);
    expect((await patch({})).status).toBe(400);
    expect(updates).toEqual([]);
  });

  it("зөвхөн өөрийн мөрийг шинэчилнэ", async () => {
    const res = await patch({ job: "  Багш ", gender: "female" });
    expect(res.status).toBe(200);
    expect(updates).toEqual([
      { table: "profiles", row: { job: "Багш", gender: "female" }, id: ME },
    ]);
  });

  it("бусдын эсвэл гадны зургийг хүлээхгүй", async () => {
    for (const url of [
      "https://cdn.example/avatars/other-1.webp",
      "https://evil.example/me-1.webp",
    ]) {
      const res = await patch({ avatarUrl: url });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "BAD_AVATAR" });
    }
    expect(updates).toEqual([]);

    const own = `https://cdn.example/storage/v1/object/public/media/avatars/${ME}-abc.webp`;
    expect((await patch({ avatarUrl: own })).status).toBe(200);
    expect(updates[0].row).toEqual({ avatar_url: own });
  });

  it("мэдэгдэхгүй үнэрийн төрлийг хасна, бүгд мэдэгдэхгүй бол 400", async () => {
    await patch({ scentPreferences: ["woody", "made-up", "woody"] });
    expect(updates[0].row).toEqual({ scent_preferences: ["woody"] });

    const res = await patch({ scentPreferences: ["made-up"] });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "BAD_FAMILY" });
  });

  it("ижил үнэртнийг том жижиг үсэг үл хамааран нэг удаа хадгална", async () => {
    await patch({
      favoritePerfumes: ["Dior Sauvage", "dior sauvage", "Aventus"],
    });
    expect(updates[0].row).toEqual({
      favorite_perfumes: ["Dior Sauvage", "Aventus"],
    });
  });
});

describe("POST /api/account/profile-info/reward", () => {
  it("туг хаалттай бол 404, RPC дуудахгүй", async () => {
    flagOn = false;
    expect((await claim()).status).toBe(404);
    expect(callRpc).not.toHaveBeenCalled();
  });

  it("зочинд 401", async () => {
    user = null;
    expect((await claim()).status).toBe(401);
    expect(callRpc).not.toHaveBeenCalled();
  });

  it("нэвтэрсэн хэрэглэгчийн id-г дамжуулж, олгосон оноог буцаана", async () => {
    callRpc.mockResolvedValue({ data: 500, error: null });
    const res = await claim();
    expect(await res.json()).toEqual({ points: 500 });
    expect(callRpc).toHaveBeenCalledWith(
      expect.anything(),
      "claim_profile_reward",
      { p_user: ME },
    );
  });

  it("RPC алдаа гарвал 500", async () => {
    callRpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect((await claim()).status).toBe(500);
  });
});

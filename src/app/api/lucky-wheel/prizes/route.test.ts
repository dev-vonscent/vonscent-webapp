import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `/api/lucky-wheel/prizes` (0165, feature flag `lucky_wheel`):
 * - туг хаалттай бол 404 — нэвтэрсэн ч юу ч уншихгүй, бичихгүй;
 * - зочинд 401;
 * - буруу body-д 400;
 * - сонголтын татгалзал бүр өөрийн статустай (NOT_FOUND → 404, бусад → 409),
 *   амжилттай бол шинэчилсэн жагсаалт.
 */

let flagOn = true;
let user: { id: string } | null = { id: "me-1" };
const getResponse = vi.fn();
const choose = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/env", () => ({ isSupabaseConfigured: true }));
vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: async () => flagOn,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user } }) },
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/features/lucky-wheel/prizes", () => ({
  getGrandPrizesResponse: (...a: unknown[]) => getResponse(...a),
  chooseGrandBundle: (...a: unknown[]) => choose(...a),
}));

const route = await import("./route");

async function get() {
  const res = await route.GET();
  if (!res) throw new Error("no response");
  return res;
}

const SPIN = "11111111-1111-4111-8111-111111111111";
const LIST = { prizes: [], options: [] };

async function post(body: unknown) {
  const res = await route.POST(
    new Request("http://x/api/lucky-wheel/prizes", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
  if (!res) throw new Error("no response");
  return res;
}

beforeEach(() => {
  flagOn = true;
  user = { id: "me-1" };
  getResponse.mockReset().mockResolvedValue(LIST);
  choose.mockReset();
});

describe("GET /api/lucky-wheel/prizes", () => {
  it("туг хаалттай бол 404", async () => {
    flagOn = false;
    expect((await get()).status).toBe(404);
    expect(getResponse).not.toHaveBeenCalled();
  });

  it("зочинд 401", async () => {
    user = null;
    expect((await get()).status).toBe(401);
  });

  it("өөрийн шагналуудыг буцаана", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(LIST);
    expect(getResponse).toHaveBeenCalledWith(expect.anything(), "me-1");
  });
});

describe("POST /api/lucky-wheel/prizes", () => {
  it("туг хаалттай бол 404, сонголт бичихгүй", async () => {
    flagOn = false;
    expect((await post({ spinId: SPIN, gender: "male" })).status).toBe(404);
    expect(choose).not.toHaveBeenCalled();
  });

  it("буруу body-д 400", async () => {
    expect((await post({ spinId: "x", gender: "male" })).status).toBe(400);
    expect((await post({ spinId: SPIN, gender: "unisex" })).status).toBe(400);
    expect(choose).not.toHaveBeenCalled();
  });

  it("татгалзлыг шалтгаанаар нь буцаана", async () => {
    choose.mockResolvedValue({ ok: false, reason: "NOT_FOUND" });
    expect((await post({ spinId: SPIN, gender: "male" })).status).toBe(404);
    for (const reason of ["LOCKED", "EXPIRED", "NO_OPTION", "SOLD_OUT"]) {
      choose.mockResolvedValue({ ok: false, reason });
      const res = await post({ spinId: SPIN, gender: "female" });
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ error: reason });
    }
  });

  it("амжилттай бол өөрийн id-гаар сонгоод жагсаалтыг буцаана", async () => {
    choose.mockResolvedValue({ ok: true });
    const res = await post({ spinId: SPIN, gender: "male" });
    expect(res.status).toBe(200);
    expect(choose).toHaveBeenCalledWith(
      expect.anything(),
      "me-1",
      SPIN,
      "male",
    );
    expect(await res.json()).toEqual(LIST);
  });
});

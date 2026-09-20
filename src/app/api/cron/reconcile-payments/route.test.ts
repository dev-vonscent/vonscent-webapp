import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Тулгалтын cron-ийн хаалга.
 *
 * Энэ route нь төлөгдөөгүй захиалга бүрийг QPay-ээс асуудаг тул нээлттэй
 * орхивол танихгүй хүн мерчантын QPay квотыг шатааж, бодит баталгаажуулалтыг
 * удаашруулж чадна. Нууц тавигдаагүй үед route нь өөрийгөө хаах ёстой —
 * мартсан env нь чимээгүйхэн нээлттэй endpoint болох ёсгүй.
 */

const verifyAndMarkOrderPaid = vi.fn();
let cronSecret = "";
let mockMode = false;

vi.mock("@/lib/env", () => ({
  env: {
    get cronSecret() {
      return cronSecret;
    },
    siteUrl: "https://vonscent.mn",
  },
}));
vi.mock("@/lib/payments/confirm-order", () => ({ verifyAndMarkOrderPaid }));
vi.mock("@/lib/payments/qpay", () => ({
  isQpayMockMode: () => mockMode,
}));
/**
 * Дуураймал нь query-ийн шүүлтүүдийг БИЧИЖ АВНА: энэ route-ийн гол дүрэм бол
 * «зөвхөн цуцлагдах гэж буй захиалга», тиймээс шүүлт нь зан төлөв өөрөө.
 */
const filters: { eq: [string, unknown][]; lte: [string, string][] } = {
  eq: [],
  lte: [],
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      const chain: Record<string, unknown> = {};
      Object.assign(chain, {
        select: () => chain,
        eq: (f: string, v: unknown) => {
          filters.eq.push([f, v]);
          return chain;
        },
        not: () => chain,
        lte: (f: string, v: string) => {
          filters.lte.push([f, v]);
          return chain;
        },
        order: () => chain,
        limit: async () => ({ data: [], error: null }),
      });
      return chain;
    },
  }),
}));

const { GET } = await import("./route");

const call = (auth?: string) =>
  GET(
    new Request("https://vonscent.mn/api/cron/reconcile-payments", {
      headers: auth ? { authorization: auth } : {},
    }),
  );

beforeEach(() => {
  verifyAndMarkOrderPaid.mockReset();
  filters.eq = [];
  filters.lte = [];
  cronSecret = "s3cret";
  mockMode = false;
});

describe("reconcile-payments auth", () => {
  it("runs for the configured cron secret", async () => {
    const res = await call("Bearer s3cret");
    expect(res.status).toBe(200);
  });

  it("rejects a missing Authorization header", async () => {
    expect((await call()).status).toBe(401);
  });

  it("rejects the wrong secret", async () => {
    expect((await call("Bearer wrong!")).status).toBe(401);
  });

  it("rejects a secret of a different length without throwing", async () => {
    // `timingSafeEqual` шидэлт хийдэг тул уртыг эхлээд шалгах ёстой.
    expect((await call("Bearer short")).status).toBe(401);
  });

  it("closes itself when CRON_SECRET is unset, rather than running open", async () => {
    cronSecret = "";
    const res = await call("Bearer anything");
    expect(res.status).toBe(503);
    expect(verifyAndMarkOrderPaid).not.toHaveBeenCalled();
  });

  it("does nothing in mock mode — there is no QPay to reconcile against", async () => {
    mockMode = true;
    const res = await call("Bearer s3cret");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ skipped: "MOCK_MODE" });
    expect(verifyAndMarkOrderPaid).not.toHaveBeenCalled();
  });
});

/**
 * QPay-ийн баримт «Cron job ашиглан гүйлгээг байнга шалгахыг хориглоно» гэж
 * заадаг. Энэ route нь тэр хоригийг зөрчихгүйн тулд бүх төлөгдөөгүй
 * захиалгыг сканнердахгүй — зөвхөн нөөц нь дуусах гэж буйг л авна. Доорх
 * тестүүд тэр хүрээг цоожилно: query өргөсвөл энд унана.
 */
describe("scope — one final check, not a polling sweep", () => {
  it("looks only at unpaid, still-pending orders", async () => {
    await call("Bearer s3cret");
    expect(filters.eq).toContainEqual(["payment_status", "unpaid"]);
    expect(filters.eq).toContainEqual(["status", "pending"]);
  });

  it("bounds the query to orders whose reserve is about to expire", async () => {
    const before = Date.now();
    await call("Bearer s3cret");
    const [field, value] = filters.lte[0]!;
    expect(field).toBe("reserve_expires_at");
    // Цонх нь ойрхон ирээдүйд байх ёстой — өнгөрсөн ч биш, хэдэн цагийн ч биш.
    const ms = new Date(value).getTime() - before;
    expect(ms).toBeGreaterThan(0);
    expect(ms).toBeLessThanOrEqual(10 * 60 * 1000);
  });

  it("never scans cancelled orders — a late payment there arrives by callback", async () => {
    await call("Bearer s3cret");
    expect(filters.eq).not.toContainEqual(["status", "cancelled"]);
  });
});

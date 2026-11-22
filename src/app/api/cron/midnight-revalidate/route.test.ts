import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Шөнийн кэш цэвэрлэгч: хэмжээний хямдрал, арга хэмжээ, hero, улирлын хил
 * (бүгд УБ 00:00) өнгөрсөн 10 минутад байвал л тохирох хүрээг цэвэрлэнэ.
 * Туг хаалттай хүснэгтийг асуухгүй.
 */

let cronSecret = "s3cret";
let hasDb = true;
type Result = {
  data: unknown[] | null;
  error: { message: string } | null;
};
/** `table.column` → хариу. Улирлын мөрүүд: `heroes.season`. */
const results: Record<string, Result> = {};
const ranges: Record<string, { gte?: string; lte?: string }> = {};
const queried: string[] = [];
const flags = new Set<string>();
const revalidateStock = vi.fn();
const revalidatePublic = vi.fn();
const revalidateHero = vi.fn();
const captureException = vi.fn();

vi.mock("@/lib/env", () => ({
  env: {
    get cronSecret() {
      return cronSecret;
    },
  },
}));
vi.mock("@/lib/cache", () => ({
  revalidateStock: () => revalidateStock(),
  revalidatePublic: () => revalidatePublic(),
  revalidateHero: () => revalidateHero(),
}));
vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: async (k: string) => flags.has(k),
}));
vi.mock("@sentry/nextjs", () => ({
  captureException: (e: unknown) => captureException(e),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () =>
    hasDb
      ? {
          from: (table: string) => {
            let key = table;
            const chain: Record<string, unknown> = {};
            Object.assign(chain, {
              select: () => chain,
              eq: (f: string, v: unknown) => {
                expect([f, v]).toEqual(["is_active", true]);
                return chain;
              },
              gte: (f: string, v: string) => {
                key = `${table}.${f}`;
                queried.push(key);
                ranges[key] = { ...ranges[key], gte: v };
                return chain;
              },
              lte: (f: string, v: string) => {
                ranges[key] = { ...ranges[key], lte: v };
                return chain;
              },
              limit: async () => results[key] ?? none,
              // Улирлын мөрүүд: `.not("season", "is", null)` дээр дуусна.
              not: async () => {
                queried.push(`${table}.season`);
                return results[`${table}.season`] ?? none;
              },
            });
            return chain;
          },
        }
      : null,
}));

const { GET } = await import("./route");

const call = (auth = `Bearer ${cronSecret}`) =>
  GET(
    new Request("http://test/api/cron/midnight-revalidate", {
      headers: { authorization: auth },
    }),
  );
const none: Result = { data: [], error: null };
const hit: Result = { data: [{ id: "x" }], error: null };

beforeEach(() => {
  cronSecret = "s3cret";
  hasDb = true;
  for (const o of [results, ranges])
    for (const k of Object.keys(o)) delete o[k];
  queried.length = 0;
  flags.clear();
  for (const f of [
    revalidateStock,
    revalidatePublic,
    revalidateHero,
    captureException,
  ])
    f.mockReset();
  vi.useRealTimers();
});

describe("хэмжээний хямдрал (0166)", () => {
  it("эхэлсэн/дууссан бол revalidateStock", async () => {
    results["product_variants.sale_ends_at"] = hit;
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      ok: true,
      revalidated: true,
      scope: { size: true, events: false, hero: false },
    });
    expect(revalidateStock).toHaveBeenCalledOnce();
    expect(revalidatePublic).not.toHaveBeenCalled();
    expect(revalidateHero).not.toHaveBeenCalled();
  });

  it("хил байхгүй бол юу ч хийхгүй", async () => {
    flags.add("sale_events").add("hero_admin");
    expect(await (await call()).json()).toEqual({
      ok: true,
      revalidated: false,
    });
    expect(revalidateStock).not.toHaveBeenCalled();
    expect(revalidatePublic).not.toHaveBeenCalled();
    expect(revalidateHero).not.toHaveBeenCalled();
  });

  it("цонх 23:59:59.999 ба 00:00-ийг багтаана (УБ 00:01-д)", async () => {
    flags.add("sale_events").add("hero_admin");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-16T16:01:00Z")); // УБ 11-17 00:01
    await call();
    const end = "2026-11-16T15:59:59.999Z"; // УБ 11-16 23:59:59.999
    const start = "2026-11-16T16:00:00.000Z"; // УБ 11-17 00:00 (exclusive end ч)
    for (const key of Object.keys(ranges)) {
      const { gte, lte } = ranges[key];
      expect(gte! <= end && end <= lte!).toBe(true);
      expect(gte! <= start && start <= lte!).toBe(true);
    }
    expect(Object.keys(ranges).sort()).toEqual([
      "heroes.ends_at",
      "heroes.starts_at",
      "product_variants.sale_ends_at",
      "product_variants.sale_starts_at",
      "sale_events.ends_at",
      "sale_events.starts_at",
    ]);
  });
});

describe("арга хэмжээ (0181)", () => {
  it("хил дээр revalidatePublic — зурвас layout-д, бусдыг хамарна", async () => {
    flags.add("sale_events");
    results["sale_events.starts_at"] = hit;
    results["product_variants.sale_starts_at"] = hit;
    expect(await (await call()).json()).toMatchObject({
      scope: { size: true, events: true, hero: false },
    });
    expect(revalidatePublic).toHaveBeenCalledOnce();
    expect(revalidateStock).not.toHaveBeenCalled();
  });

  it("туг хаалттай бол sale_events-ийг асуухгүй", async () => {
    results["sale_events.ends_at"] = hit;
    expect(await (await call()).json()).toEqual({
      ok: true,
      revalidated: false,
    });
    expect(queried.some((k) => k.startsWith("sale_events"))).toBe(false);
    expect(revalidatePublic).not.toHaveBeenCalled();
  });
});

describe("hero (0182) ба улирал (0185)", () => {
  it("өөрийн хугацааны хил → зөвхөн revalidateHero", async () => {
    flags.add("hero_admin");
    results["heroes.ends_at"] = hit;
    expect(await (await call()).json()).toMatchObject({
      scope: { size: false, events: false, hero: true },
    });
    expect(revalidateHero).toHaveBeenCalledOnce();
    expect(revalidatePublic).not.toHaveBeenCalled();
    expect(revalidateStock).not.toHaveBeenCalled();
  });

  it("улирлын эхлэл (УБ 00:00) → revalidateHero", async () => {
    flags.add("hero_admin");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-30T16:01:00Z")); // УБ 12-01 00:01
    results["heroes.season"] = {
      data: [
        {
          id: "h1",
          season: "winter",
          season_start_md: "12-01",
          is_active: true,
          desktop_image: { url: "d" },
          mobile_image: { url: "m" },
        },
      ],
      error: null,
    };
    expect(await (await call()).json()).toMatchObject({
      scope: { hero: true },
    });
    expect(revalidateHero).toHaveBeenCalledOnce();

    // Өдрийн дунд — хилээс хол.
    revalidateHero.mockReset();
    vi.setSystemTime(new Date("2026-12-01T04:00:00Z"));
    expect(await (await call()).json()).toEqual({
      ok: true,
      revalidated: false,
    });
    expect(revalidateHero).not.toHaveBeenCalled();
  });

  it("туг хаалттай бол heroes-ийг асуухгүй", async () => {
    results["heroes.starts_at"] = hit;
    await call();
    expect(queried.some((k) => k.startsWith("heroes"))).toBe(false);
    expect(revalidateHero).not.toHaveBeenCalled();
  });
});

describe("хамгаалалт", () => {
  it("DB алдаа → Sentry + 500, кэш цэвэрлэхгүй", async () => {
    flags.add("sale_events");
    results["sale_events.ends_at"] = { data: null, error: { message: "boom" } };
    results["product_variants.sale_starts_at"] = hit;
    const res = await call();
    expect(res.status).toBe(500);
    expect(captureException).toHaveBeenCalledOnce();
    expect(revalidateStock).not.toHaveBeenCalled();
    expect(revalidatePublic).not.toHaveBeenCalled();
  });

  it("буруу нууц → 401, нууц тавиагүй → 503", async () => {
    expect((await call("Bearer wrong!")).status).toBe(401);
    expect((await call("")).status).toBe(401);
    cronSecret = "";
    expect((await call("Bearer ")).status).toBe(503);
    expect(revalidateStock).not.toHaveBeenCalled();
  });

  it("Supabase-гүй (DEMO) бол алгасна", async () => {
    hasDb = false;
    expect(await (await call()).json()).toEqual({
      ok: true,
      skipped: "NO_DB",
    });
  });
});

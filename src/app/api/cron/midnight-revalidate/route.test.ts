import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Шөнийн кэш цэвэрлэгч: хямдралын хил (УБ 00:00 эхлэл / 23:59:59.999
 * төгсгөл) өнгөрсөн 10 минутад байвал л `revalidateStock()`.
 */

let cronSecret = "s3cret";
let hasDb = true;
type Result = {
  data: { id: string }[] | null;
  error: { message: string } | null;
};
const results: Record<string, Result> = {};
const ranges: Record<string, { gte?: string; lte?: string }> = {};
const revalidateStock = vi.fn();
const captureException = vi.fn();

vi.mock("@/lib/env", () => ({
  env: {
    get cronSecret() {
      return cronSecret;
    },
  },
}));
vi.mock("@/lib/cache", () => ({ revalidateStock: () => revalidateStock() }));
vi.mock("@sentry/nextjs", () => ({
  captureException: (e: unknown) => captureException(e),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () =>
    hasDb
      ? {
          from: (table: string) => {
            expect(table).toBe("product_variants");
            let column = "";
            const chain: Record<string, unknown> = {};
            Object.assign(chain, {
              select: () => chain,
              eq: (f: string, v: unknown) => {
                expect([f, v]).toEqual(["is_active", true]);
                return chain;
              },
              gte: (f: string, v: string) => {
                column = f;
                ranges[f] = { ...ranges[f], gte: v };
                return chain;
              },
              lte: (f: string, v: string) => {
                ranges[f] = { ...ranges[f], lte: v };
                return chain;
              },
              limit: async () => results[column],
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

beforeEach(() => {
  cronSecret = "s3cret";
  hasDb = true;
  results.sale_starts_at = none;
  results.sale_ends_at = none;
  for (const k of Object.keys(ranges)) delete ranges[k];
  revalidateStock.mockReset();
  captureException.mockReset();
  vi.useRealTimers();
});

describe("GET /api/cron/midnight-revalidate", () => {
  it("хямдрал эхэлсэн/дууссан бол кэш цэвэрлэнэ", async () => {
    results.sale_ends_at = { data: [{ id: "v1" }], error: null };
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, revalidated: true });
    expect(revalidateStock).toHaveBeenCalledOnce();

    revalidateStock.mockReset();
    results.sale_ends_at = none;
    results.sale_starts_at = { data: [{ id: "v2" }], error: null };
    expect(await (await call()).json()).toEqual({
      ok: true,
      revalidated: true,
    });
    expect(revalidateStock).toHaveBeenCalledOnce();
  });

  it("хил байхгүй бол юу ч хийхгүй", async () => {
    const res = await call();
    expect(await res.json()).toEqual({ ok: true, revalidated: false });
    expect(revalidateStock).not.toHaveBeenCalled();
  });

  it("цонх 23:59:59.999-ийн төгсгөлийг багтаана (УБ 00:01-д)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-16T16:01:00Z")); // УБ 11-17 00:01
    await call();
    const end = "2026-11-16T15:59:59.999Z"; // УБ 11-16 23:59:59.999
    const start = "2026-11-16T16:00:00.000Z"; // УБ 11-17 00:00
    for (const col of ["sale_starts_at", "sale_ends_at"]) {
      const { gte, lte } = ranges[col];
      expect(gte! <= end && end <= lte!).toBe(true);
      expect(gte! <= start && start <= lte!).toBe(true);
    }
  });

  it("DB алдаа → Sentry + 500, кэш цэвэрлэхгүй", async () => {
    results.sale_starts_at = { data: null, error: { message: "boom" } };
    const res = await call();
    expect(res.status).toBe(500);
    expect(captureException).toHaveBeenCalledOnce();
    expect(revalidateStock).not.toHaveBeenCalled();
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

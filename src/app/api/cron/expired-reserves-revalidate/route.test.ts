import { beforeEach, describe, expect, it, vi } from "vitest";

/** pg_cron-ы нөөцийн цуцлалтын дараа үлдэгдлийн кэшийг цэвэрлэх эсэх. */

let cronSecret = "s3cret";
let result: {
  data: { id: string }[] | null;
  error: { message: string } | null;
} = { data: [], error: null };
const calls: [string, ...unknown[]][] = [];
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
  createAdminClient: () => ({
    from: (table: string) => {
      calls.push(["from", table]);
      const chain: Record<string, unknown> = {};
      for (const m of ["select", "eq", "is", "gte"]) {
        chain[m] = (...a: unknown[]) => {
          calls.push([m, ...a]);
          return chain;
        };
      }
      chain.limit = async () => result;
      return chain;
    },
  }),
}));

const { GET } = await import("./route");

const call = (auth = `Bearer ${cronSecret}`) =>
  GET(
    new Request("http://test/api/cron/expired-reserves-revalidate", {
      headers: { authorization: auth },
    }),
  );

beforeEach(() => {
  cronSecret = "s3cret";
  result = { data: [], error: null };
  calls.length = 0;
  revalidateStock.mockReset();
  captureException.mockReset();
});

describe("GET /api/cron/expired-reserves-revalidate", () => {
  it("системийн цуцлалт байвал кэш цэвэрлэнэ", async () => {
    result = { data: [{ id: "h1" }], error: null };
    expect(await (await call()).json()).toEqual({
      ok: true,
      revalidated: true,
    });
    expect(revalidateStock).toHaveBeenCalledOnce();
    expect(calls).toContainEqual(["from", "order_status_history"]);
    expect(calls).toContainEqual(["eq", "status", "cancelled"]);
    expect(calls).toContainEqual(["is", "changed_by", null]);
  });

  it("цуцлалт байхгүй бол юу ч хийхгүй", async () => {
    expect(await (await call()).json()).toEqual({
      ok: true,
      revalidated: false,
    });
    expect(revalidateStock).not.toHaveBeenCalled();
  });

  it("DB алдаа → Sentry + 500, кэш хөндөхгүй", async () => {
    result = { data: null, error: { message: "boom" } };
    expect((await call()).status).toBe(500);
    expect(captureException).toHaveBeenCalledOnce();
    expect(revalidateStock).not.toHaveBeenCalled();
  });

  it("буруу нууц → 401", async () => {
    expect((await call("Bearer nope!")).status).toBe(401);
    expect(revalidateStock).not.toHaveBeenCalled();
  });
});

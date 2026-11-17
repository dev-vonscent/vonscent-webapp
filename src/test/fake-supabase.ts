import { vi } from "vitest";

/**
 * Supabase-ийн уншилтын алдааг шалгах тестэд (#284 — тохируулагдсан үед
 * алдаа шидэгдэх ёстой). `from()`/`rpc()`/`callRpc()`-ийн хариуг хүснэгт,
 * функцийн нэрээр тохируулна; заагаагүй нь `{ data: [], error: null }`.
 */
export type FakeResult = { data: unknown; error: { message: string } | null };

export const DB_DOWN: FakeResult = {
  data: null,
  error: { message: "Project not specified" },
};

/** Chainable query builder: every call returns itself; awaiting yields `result`. */
function query(result: FakeResult) {
  const self: object = new Proxy(
    {},
    {
      get(_, prop) {
        if (prop === "then") {
          return (resolve: (r: FakeResult) => unknown) => resolve(result);
        }
        return () => self;
      },
    },
  );
  return self;
}

export interface FakeDb {
  tables: Record<string, FakeResult>;
  rpcs: Record<string, FakeResult>;
}

/**
 * Модулиудыг шинээр ачаалж, Supabase / env / кэш / тугийг mock-лоно.
 * Дараа нь `await import("./api")` хийнэ.
 */
export function mockSupabase(
  db: FakeDb,
  { configured, flags = true }: { configured: boolean; flags?: boolean },
) {
  vi.resetModules();
  const ok: FakeResult = { data: [], error: null };
  vi.doMock("@/lib/env", () => ({ env: {}, isSupabaseConfigured: configured }));
  vi.doMock("next/cache", () => ({ unstable_cache: <T>(fn: T) => fn }));
  vi.doMock("@/lib/feature-flags", () => ({
    isFeatureEnabled: async () => flags,
  }));
  vi.doMock("@/lib/supabase/public", () => ({
    createPublicClient: () =>
      configured
        ? {
            from: (t: string) => query(db.tables[t] ?? ok),
            rpc: (fn: string) => query(db.rpcs[fn] ?? ok),
          }
        : null,
  }));
  vi.doMock("@/lib/supabase/rpc", () => ({
    callRpc: async (_c: unknown, fn: string) => db.rpcs[fn] ?? ok,
  }));
}

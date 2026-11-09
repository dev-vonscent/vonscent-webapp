import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AuthRetryableFetchError,
  AuthSessionMissingError,
  type SupabaseClient,
} from "@supabase/supabase-js";
import {
  NOTIFICATION_POLL_FRESH_MAX,
  NOTIFICATION_POLL_LOOKBACK_MS,
} from "@/lib/constants";

const flags = new Set<string>();
const getUser = vi.fn();

vi.mock("@/lib/env", () => ({ isSupabaseConfigured: true }));
vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: async (key: string) => flags.has(key),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser } }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/storage/storage", () => ({ publicUrl: (p: string) => p }));

const { pollNotifications, notificationsUserGate } = await import("./server");
const { decodeCursor, encodeCursor, ZERO_UUID } = await import("./cursor");

/**
 * Poll-ын цонх (plan §12): cursor-оос LOOKBACK ухарч, хоцорч commit хийсэн
 * мөрийг барина; cursor зөвхөн урагшилна.
 */

const NOW = "2026-10-19T04:00:00.000Z";
const USER = "user-1";
const B_ID = "0b000000-0000-4000-8000-000000000000";

type Call = [method: string, args: unknown[]];
interface Query {
  table: string;
  calls: Call[];
}

function row(id: string, visibleAt: string) {
  return {
    id,
    kind: "promotion",
    title: id,
    body: null,
    url: null,
    image_path: null,
    read_at: null,
    visible_at: visibleAt,
  };
}

function fakeAdmin(opts: {
  rows?: ReturnType<typeof row>[];
  unread?: number;
  freshCount?: number;
  spin?: { enabled?: boolean } | null;
  error?: string;
}) {
  const queries: Query[] = [];
  const admin = {
    from: (table: string) => {
      const q: Query = { table, calls: [] };
      queries.push(q);
      const chain: Record<string, unknown> = {};
      for (const m of [
        "select",
        "eq",
        "lte",
        "neq",
        "is",
        "gt",
        "order",
        "limit",
      ]) {
        chain[m] = (...args: unknown[]) => {
          q.calls.push([m, args]);
          return chain;
        };
      }
      chain.maybeSingle = async () => ({
        data: opts.spin === undefined ? null : { value: opts.spin },
      });
      chain.then = (resolve: (v: unknown) => unknown) => {
        const head = q.calls.some(
          ([m, a]) => m === "select" && (a[1] as { head?: boolean })?.head,
        );
        const error = opts.error ? { message: opts.error } : null;
        return resolve(
          head
            ? { data: null, count: opts.unread ?? 0, error }
            : {
                data: opts.rows ?? [],
                count: opts.freshCount ?? opts.rows?.length ?? 0,
                error,
              },
        );
      };
      return chain;
    },
  };
  const notifQueries = () =>
    queries.filter((q) => q.table === "user_notifications");
  const fresh = () =>
    notifQueries().find((q) => q.calls.some(([m]) => m === "gt"))!;
  return { admin: admin as unknown as SupabaseClient, notifQueries, fresh };
}

const argsOf = (q: Query, method: string) =>
  q.calls.filter(([m]) => m === method).map(([, a]) => a);

const minus = (iso: string, ms: number) =>
  new Date(Date.parse(iso) - ms).toISOString();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW));
  flags.clear();
  flags.add("notifications");
  flags.add("lucky_wheel");
});
afterEach(() => vi.useRealTimers());

describe("pollNotifications", () => {
  it("anchors the first poll's window on server now and keeps the cursor there", async () => {
    const r = row("a", minus(NOW, 60_000));
    const { admin, fresh } = fakeAdmin({ rows: [r], unread: 3 });

    const res = await pollNotifications(admin, USER, null);

    expect(argsOf(fresh(), "gt")).toEqual([
      ["visible_at", minus(NOW, NOTIFICATION_POLL_LOOKBACK_MS)],
    ]);
    expect(argsOf(fresh(), "lte")).toEqual([["visible_at", NOW]]);
    expect(argsOf(fresh(), "limit")).toEqual([[NOTIFICATION_POLL_FRESH_MAX]]);
    expect(res.unread).toBe(3);
    expect(res.fresh.map((n) => n.id)).toEqual(["a"]);
    // Мөр now-оос өмнө — cursor now дээр үлдэнэ.
    expect(decodeCursor(res.nextCursor)).toEqual({
      visibleAt: NOW,
      id: ZERO_UUID,
    });
  });

  it("looks back from the cursor and advances it to a newer row", async () => {
    const cursor = { visibleAt: minus(NOW, 120_000), id: ZERO_UUID };
    const newer = row(B_ID, minus(NOW, 30_000));
    const { admin, fresh } = fakeAdmin({ rows: [newer] });

    const res = await pollNotifications(admin, USER, cursor);

    expect(argsOf(fresh(), "gt")).toEqual([
      ["visible_at", minus(cursor.visibleAt, NOTIFICATION_POLL_LOOKBACK_MS)],
    ]);
    expect(decodeCursor(res.nextCursor)).toEqual({
      visibleAt: newer.visible_at,
      id: B_ID,
    });
  });

  it("returns a late-committed row behind the cursor without moving the cursor back", async () => {
    const cursor = { visibleAt: minus(NOW, 60_000), id: ZERO_UUID };
    // Урт transaction: visible_at нь cursor-оос өмнө, гэхдээ цонх дотор.
    const late = row("late", minus(NOW, 5 * 60_000));
    const { admin } = fakeAdmin({ rows: [late] });

    const res = await pollNotifications(admin, USER, cursor);

    expect(res.fresh.map((n) => n.id)).toEqual(["late"]);
    expect(res.nextCursor).toBe(encodeCursor(cursor));
  });

  it("keeps the cursor on an empty window", async () => {
    const cursor = { visibleAt: minus(NOW, 60_000), id: ZERO_UUID };
    const { admin } = fakeAdmin({ rows: [] });

    const res = await pollNotifications(admin, USER, cursor);

    expect(res.fresh).toEqual([]);
    expect(res.freshCount).toBe(0);
    expect(res.nextCursor).toBe(encodeCursor(cursor));
  });

  it("reports the full window count when more than FRESH_MAX rows wait", async () => {
    const rows = Array.from({ length: NOTIFICATION_POLL_FRESH_MAX }, (_, i) =>
      row(`r${i}`, minus(NOW, 1_000 * (i + 1))),
    );
    const { admin } = fakeAdmin({ rows, freshCount: 25 });

    const res = await pollNotifications(admin, USER, null);

    expect(res.fresh).toHaveLength(NOTIFICATION_POLL_FRESH_MAX);
    expect(res.freshCount).toBe(25);
  });

  it("scopes both queries to the session user", async () => {
    const { admin, notifQueries } = fakeAdmin({});
    await pollNotifications(admin, USER, null);
    for (const q of notifQueries()) {
      expect(argsOf(q, "eq")).toContainEqual(["user_id", USER]);
    }
  });

  it.each([
    ["lucky_wheel flag off", false, { enabled: true }, true],
    ["spin setting disabled", true, { enabled: false }, true],
    ["spin open", true, { enabled: true }, false],
    ["no spin setting", true, undefined, false],
  ])("free spin rows when %s → hidden=%s", async (_l, flagOn, spin, hidden) => {
    if (!flagOn) flags.delete("lucky_wheel");
    const { admin, notifQueries } = fakeAdmin({ spin });
    await pollNotifications(admin, USER, null);
    for (const q of notifQueries()) {
      expect(argsOf(q, "neq")).toEqual(
        hidden ? [["kind", "free_spin_ready"]] : [],
      );
    }
  });

  it("throws on a db error (route → 500)", async () => {
    const { admin } = fakeAdmin({ error: "boom" });
    await expect(pollNotifications(admin, USER, null)).rejects.toThrow(/boom/);
  });
});

describe("notificationsUserGate", () => {
  it("is 404 while the flag is off", async () => {
    flags.delete("notifications");
    const gate = await notificationsUserGate();
    expect(gate.response?.status).toBe(404);
  });

  it("is 401 when there is no session", async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: new AuthSessionMissingError(),
    });
    const gate = await notificationsUserGate();
    expect(gate.response?.status).toBe(401);
  });

  it("is 503 (retryable) when auth is briefly unreachable", async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: new AuthRetryableFetchError("fetch failed", 0),
    });
    const gate = await notificationsUserGate();
    expect(gate.response?.status).toBe(503);
  });

  it("passes the session user through", async () => {
    getUser.mockResolvedValue({ data: { user: { id: USER } }, error: null });
    const gate = await notificationsUserGate();
    expect(gate.user?.id).toBe(USER);
  });
});

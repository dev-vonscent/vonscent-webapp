import { beforeEach, describe, expect, it } from "vitest";
import { DB_DOWN, mockSupabase, type FakeDb } from "@/test/fake-supabase";

let db: FakeDb;
beforeEach(() => {
  db = { tables: {}, rpcs: {} };
});

describe("getLiveHero", () => {
  it("throws instead of falling back to the code hero for an hour (#284)", async () => {
    db.rpcs.live_heroes = DB_DOWN;
    mockSupabase(db, { configured: true });
    const { getLiveHero } = await import("./api");
    await expect(getLiveHero()).rejects.toThrow("live_heroes");
  });

  it("no live hero is still null (→ code hero)", async () => {
    db.rpcs.live_heroes = { data: [], error: null };
    mockSupabase(db, { configured: true });
    const { getLiveHero } = await import("./api");
    await expect(getLiveHero()).resolves.toBeNull();
  });

  it("flag off / demo → null without touching the DB", async () => {
    db.rpcs.live_heroes = DB_DOWN;
    mockSupabase(db, { configured: true, flags: false });
    await expect((await import("./api")).getLiveHero()).resolves.toBeNull();
    mockSupabase(db, { configured: false });
    await expect((await import("./api")).getLiveHero()).resolves.toBeNull();
  });
});

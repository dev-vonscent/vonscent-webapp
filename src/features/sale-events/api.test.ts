import { beforeEach, describe, expect, it } from "vitest";
import { DB_DOWN, mockSupabase, type FakeDb } from "@/test/fake-supabase";

/** Тохируулагдсан үед алдаа шидэгдэнэ — `[]`/`{}`/null ISR-д кэшлэгдэхгүй (#284). */
let db: FakeDb;
beforeEach(() => {
  db = { tables: {}, rpcs: {} };
});

async function load(configured = true, flags = true) {
  mockSupabase(db, { configured, flags });
  return import("./api");
}

describe("sale-events public reads", () => {
  it("live events throw instead of an empty list", async () => {
    db.rpcs.live_sale_events = DB_DOWN;
    const { getLiveSaleEvents } = await load();
    await expect(getLiveSaleEvents()).rejects.toThrow("live_sale_events");
  });

  it("event discounts throw instead of {} (cards without «~10%»)", async () => {
    db.rpcs.live_event_discounts = DB_DOWN;
    const { getLiveEventPcts } = await load();
    await expect(getLiveEventPcts()).rejects.toThrow("live_event_discounts");
  });

  it("public event state throws instead of null", async () => {
    db.rpcs.sale_event_public = DB_DOWN;
    const { getSaleEventPublic } = await load();
    await expect(getSaleEventPublic("black-friday")).rejects.toThrow(
      "sale_event_public",
    );
  });

  it("flag off → empty, the RPC is never consulted", async () => {
    db.rpcs.live_sale_events = DB_DOWN;
    db.rpcs.live_event_discounts = DB_DOWN;
    const { getLiveSaleEvents, getLiveEventPcts } = await load(true, false);
    await expect(getLiveSaleEvents()).resolves.toEqual([]);
    await expect(getLiveEventPcts()).resolves.toEqual({});
  });

  it("demo mode → empty", async () => {
    const { getLiveSaleEvents, getSaleEventPublic } = await load(false);
    await expect(getLiveSaleEvents()).resolves.toEqual([]);
    await expect(getSaleEventPublic("black-friday")).resolves.toBeNull();
  });
});

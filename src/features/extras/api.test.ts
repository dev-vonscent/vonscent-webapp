import { beforeEach, describe, expect, it } from "vitest";
import { DB_DOWN, mockSupabase, type FakeDb } from "@/test/fake-supabase";

/** Тохируулагдсан үед алдаа шидэгдэнэ — `[]`/null ISR-д кэшлэгдэхгүй (#284). */
let db: FakeDb;
beforeEach(() => {
  db = { tables: {}, rpcs: {} };
});

async function load(configured = true) {
  mockSupabase(db, { configured });
  return import("./api");
}

describe("extras public reads", () => {
  it("the list throws instead of an empty shop", async () => {
    db.rpcs.extras_catalog = DB_DOWN;
    const { getShopExtras } = await load();
    await expect(getShopExtras()).rejects.toThrow("extras_catalog failed");
  });

  it("a detail error throws instead of null (cached 404)", async () => {
    db.rpcs.extra_detail = DB_DOWN;
    const { getShopExtra } = await load();
    await expect(getShopExtra("gift-box")).rejects.toThrow(
      "extra_detail failed",
    );
  });

  it("a missing extra is still null", async () => {
    db.rpcs.extra_detail = { data: null, error: null };
    const { getShopExtra } = await load();
    await expect(getShopExtra("nope")).resolves.toBeNull();
  });

  it("bottle facets throw instead of an empty filter map", async () => {
    db.rpcs.extras_bottle_facets = DB_DOWN;
    const { getBottleFacets } = await load();
    await expect(getBottleFacets()).rejects.toThrow(
      "extras_bottle_facets failed",
    );
  });

  it("«Энэ үнэрийн шил» throws instead of vanishing", async () => {
    db.rpcs.extras_bottles_for = DB_DOWN;
    const { getBottlesFor } = await load();
    await expect(getBottlesFor("p1")).rejects.toThrow(
      "extras_bottles_for failed",
    );
  });

  it("gift offers propagate a list failure (cart / checkout get a 5xx, not «no gifts»)", async () => {
    db.rpcs.extras_catalog = DB_DOWN;
    const { getGiftOffers } = await load();
    await expect(getGiftOffers({ live: true })).rejects.toThrow(
      "extras_catalog failed",
    );
  });

  it("demo mode → empty / null", async () => {
    const { getShopExtras, getShopExtra, getBottlesFor } = await load(false);
    await expect(getShopExtras()).resolves.toEqual([]);
    await expect(getShopExtra("x")).resolves.toBeNull();
    await expect(getBottlesFor("p1")).resolves.toEqual([]);
  });
});

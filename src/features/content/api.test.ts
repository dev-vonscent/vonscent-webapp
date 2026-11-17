import { beforeEach, describe, expect, it } from "vitest";
import { DB_DOWN, mockSupabase, type FakeDb } from "@/test/fake-supabase";

/** Тохируулагдсан үед алдаа шидэгдэнэ — өгөгдмөл / хоосон нүүр кэшлэгдэхгүй (#284). */
let db: FakeDb;
beforeEach(() => {
  db = { tables: {}, rpcs: {} };
});

async function load(configured = true) {
  mockSupabase(db, { configured });
  return import("./api");
}

describe("content public reads", () => {
  it("settings throw instead of serving defaults", async () => {
    db.tables.settings = DB_DOWN;
    const { getSocialSettings, getShippingSettings } = await load();
    await expect(getSocialSettings()).rejects.toThrow("settings failed");
    await expect(getShippingSettings()).rejects.toThrow("settings failed");
  });

  it("home sections throw instead of an empty home page", async () => {
    db.tables.home_sections = DB_DOWN;
    const { getHomeSections } = await load();
    await expect(getHomeSections()).rejects.toThrow("home_sections failed");
  });

  it("the featured rail throws instead of switching to the pre-0144 rule", async () => {
    db.tables.home_sections = {
      data: [
        {
          id: "s1",
          kind: "featured",
          title: "Онцлох",
          subtitle: null,
          href: null,
          tag: null,
          max_items: 8,
          home_section_products: [],
        },
      ],
      error: null,
    };
    db.tables.products = DB_DOWN;
    const { getHomeSections } = await load();
    await expect(getHomeSections()).rejects.toThrow("featured rail failed");
  });

  it("no settings row is a real answer → defaults", async () => {
    db.tables.settings = { data: [], error: null };
    const { getAboutSettings, DEFAULT_ABOUT } = await load();
    await expect(getAboutSettings()).resolves.toEqual(DEFAULT_ABOUT);
  });

  it("demo mode → defaults, no sections", async () => {
    const { getAboutSettings, getHomeSections, DEFAULT_ABOUT } =
      await load(false);
    await expect(getAboutSettings()).resolves.toEqual(DEFAULT_ABOUT);
    await expect(getHomeSections()).resolves.toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addBottleImage, BOTTLE_MASTER_PATH } from "./bottle-image";
import { BOTTLE_IMAGE_URL_RE } from "@/lib/constants";

type Row = { id: string; sort_order: number };

/**
 * `addBottleImage`-ийн хэрэглэдэг supabase-js-ийн хэсгийг л дуурайна: эх
 * хувийг хуулах, галерейг унших, байр шилжүүлэх, шинэ мөр оруулах.
 */
function fakeSupabase(rows: Row[], { copyError = false } = {}) {
  const gallery = rows.map((r) => ({ ...r }));
  const copies: { from: string; to: string }[] = [];
  const inserts: Record<string, unknown>[] = [];

  const client = {
    storage: {
      from: () => ({
        copy: async (from: string, to: string) => {
          copies.push({ from, to });
          return { error: copyError ? { message: "not found" } : null };
        },
      }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          order: async () => ({
            data: [...gallery].sort((a, b) => a.sort_order - b.sort_order),
          }),
        }),
      }),
      update: (patch: { sort_order: number }) => ({
        eq: async (_col: string, id: string) => {
          const row = gallery.find((r) => r.id === id);
          if (row) row.sort_order = patch.sort_order;
          return { error: null };
        },
      }),
      insert: async (row: Record<string, unknown>) => {
        inserts.push(row);
        gallery.push({ id: "bottle", sort_order: row.sort_order as number });
        return { error: null };
      },
    }),
  };

  /** Галерейн дараалал — id-уудаар. */
  const order = () =>
    [...gallery].sort((a, b) => a.sort_order - b.sort_order).map((r) => r.id);

  return {
    client: client as unknown as SupabaseClient,
    copies,
    inserts,
    order,
  };
}

const rows = (...ids: string[]): Row[] =>
  ids.map((id, i) => ({ id, sort_order: i }));

describe("addBottleImage", () => {
  it("AI-ийн 2 зургийн дараа 3 дахь зураг болно", async () => {
    const sb = fakeSupabase(rows("packshot", "notes"));
    await addBottleImage(sb.client, "p1", "creed-aventus", "black", "third");
    expect(sb.order()).toEqual(["packshot", "notes", "bottle"]);
  });

  it("3 дахь байранд орохдоо араас нь байсан зургуудыг ухраана", async () => {
    const sb = fakeSupabase(rows("a", "b", "c", "d"));
    await addBottleImage(sb.client, "p1", "x", "pink", "third");
    expect(sb.order()).toEqual(["a", "b", "bottle", "c", "d"]);
  });

  it("зураг 2-оос цөөн бол «third» нь хамгийн ард орно", async () => {
    const sb = fakeSupabase(rows("packshot"));
    await addBottleImage(sb.client, "p1", "x", "silver", "third");
    expect(sb.order()).toEqual(["packshot", "bottle"]);
  });

  it("гараар оруулсан зургуудын хамгийн ард нэмэгдэнэ", async () => {
    const sb = fakeSupabase(rows("u1", "u2", "u3", "u4"));
    await addBottleImage(sb.client, "p1", "x", "black", "end");
    expect(sb.order()).toEqual(["u1", "u2", "u3", "u4", "bottle"]);
    expect(sb.inserts[0].sort_order).toBe(4);
  });

  it("галерей хоосон бол ганц зураг болно", async () => {
    const sb = fakeSupabase([]);
    await addBottleImage(sb.client, "p1", "x", "black", "end");
    expect(sb.inserts[0].sort_order).toBe(0);
  });

  it("сонгосон савны эх хувийг бүтээгдэхүүний хавтас руу хуулна", async () => {
    // Хуваалцсан объект руу заавал админ нэг бүтээгдэхүүнээс устгахад бүгд
    // эвдэрнэ — тиймээс бүтээгдэхүүн бүр өөрийн хуулбартай.
    const sb = fakeSupabase([]);
    await addBottleImage(sb.client, "p1", "creed-aventus", "pink", "end");
    expect(sb.copies[0].from).toBe(BOTTLE_MASTER_PATH("pink"));
    expect(sb.copies[0].to).toMatch(/^products\/creed-aventus\/bottle-/);
    expect(sb.inserts[0]).toMatchObject({
      product_id: "p1",
      alt: "Ягаан сав",
      is_visible: true,
    });
  });

  it("хуулбарын URL-ийг дэлгүүр савны зураг гэж танина", async () => {
    // ProductGallery савны зургийг тайрахгүй — URL-ийн нэрээр нь танина.
    const sb = fakeSupabase([]);
    await addBottleImage(sb.client, "p1", "x", "silver", "end");
    expect(sb.inserts[0].url).toMatch(BOTTLE_IMAGE_URL_RE);
  });

  it("эх хувь хуулагдахгүй бол галерейд юу ч нэмэхгүй, шидэхгүй", async () => {
    const sb = fakeSupabase(rows("a", "b"), { copyError: true });
    await expect(
      addBottleImage(sb.client, "p1", "x", "black", "third"),
    ).resolves.toBeUndefined();
    expect(sb.inserts).toHaveLength(0);
    expect(sb.order()).toEqual(["a", "b"]);
  });
});

describe("BOTTLE_IMAGE_URL_RE", () => {
  it("бусад галерейн зургийг савны зураг гэж андуурахгүй", () => {
    const base =
      "https://x.supabase.co/storage/v1/object/public/product-images";
    for (const name of [
      "0b58d11e-3f37-4aca-84e4-f7ea563989cc.webp",
      "ai-0b58d11e-3f37-4aca-84e4-f7ea563989cc.png",
      "notes-0b58d11e-3f37-4aca-84e4-f7ea563989cc.webp",
    ]) {
      expect(
        BOTTLE_IMAGE_URL_RE.test(`${base}/products/bottle-x/${name}`),
      ).toBe(false);
    }
  });
});

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/storage/storage", () => ({
  publicUrl: (p: string) => `https://s/${p}`,
  uploadImage: vi.fn(),
}));

const { heroProductRefs } = await import("./hero-references");

/** `.from(t).select().in()[.order()]` → тогтмол өгөгдөл. */
function fakeSupabase(tables: Record<string, unknown[]>) {
  return {
    from(t: string) {
      const res = { data: tables[t] ?? [], error: null };
      const chain = {
        select: () => chain,
        in: () => chain,
        order: () => Promise.resolve(res),
        then: (f: (v: typeof res) => unknown) => Promise.resolve(res).then(f),
      };
      return chain;
    },
  } as never;
}

describe("heroProductRefs", () => {
  const products = [
    { id: "a", brand: "Creed", name: "Aventus", reference_image_url: "https://s/ref-a.png" },
    { id: "b", brand: "PdM", name: "Layton", reference_image_url: null },
    { id: "c", brand: "Dior", name: "Sauvage", reference_image_url: null },
  ];
  const images = [
    { product_id: "b", url: "https://s/b-hidden.webp", is_visible: false },
    { product_id: "b", url: "https://s/b-visible.webp", is_visible: true },
  ];

  it("AI лавлах → харагдах зураг; сонгосон дараалал хадгалагдана", async () => {
    const r = await heroProductRefs(fakeSupabase({ products, product_images: images }), ["b", "a"]);
    expect(r).toEqual({
      ok: true,
      products: [
        { id: "b", brand: "PdM", name: "Layton", url: "https://s/b-visible.webp" },
        { id: "a", brand: "Creed", name: "Aventus", url: "https://s/ref-a.png" },
      ],
    });
  });

  it("зураггүй / олдохгүй бараа → нэрээр нь алдаа", async () => {
    const r = await heroProductRefs(fakeSupabase({ products, product_images: images }), ["a", "c", "zz"]);
    expect(r).toEqual({ ok: false, missing: ["Dior Sauvage", "zz"] });
  });

  it("сонгоогүй бол хоосон", async () => {
    expect(await heroProductRefs(fakeSupabase({}), [])).toEqual({ ok: true, products: [] });
  });
});

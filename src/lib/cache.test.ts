import { beforeEach, describe, expect, it, vi } from "vitest";

const revalidatePath = vi.fn();
const revalidateTag = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...a: unknown[]) => revalidatePath(...a),
  revalidateTag: (...a: unknown[]) => revalidateTag(...a),
}));

const { revalidatePublic, revalidateStock } = await import("./cache");
const { CACHE_TAG_CATALOG, CACHE_TAG_TAXONOMY } = await import("./cache-tags");

beforeEach(() => {
  revalidatePath.mockReset();
  revalidateTag.mockReset();
});

describe("revalidateStock", () => {
  it("каталогийн tag ба үлдэгдэл харуулдаг хуудсуудыг л цэвэрлэнэ", () => {
    revalidateStock();
    expect(revalidateTag.mock.calls).toEqual([[CACHE_TAG_CATALOG, "max"]]);
    expect(revalidatePath.mock.calls).toEqual([
      ["/"],
      ["/products/[slug]", "page"],
      ["/collections"],
      ["/collections/[slug]", "page"],
    ]);
  });

  it("бүх сайтыг (layout) болон taxonomy-г цэвэрлэхгүй — блог, FAQ, about хөндөгдөхгүй", () => {
    revalidateStock();
    expect(revalidatePath).not.toHaveBeenCalledWith("/", "layout");
    expect(revalidateTag).not.toHaveBeenCalledWith(CACHE_TAG_TAXONOMY, "max");
    const paths = revalidatePath.mock.calls.map((c) => c[0] as string);
    for (const p of ["/blog", "/faq", "/about", "/contact"]) {
      expect(paths.some((x) => x.startsWith(p))).toBe(false);
    }
  });
});

describe("revalidatePublic", () => {
  it("админы бичилт бүх сайтыг цэвэрлэсээр", () => {
    revalidatePublic();
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });
});

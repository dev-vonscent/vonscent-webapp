import { beforeEach, describe, expect, it, vi } from "vitest";

const revalidatePath = vi.fn();
const revalidateTag = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...a: unknown[]) => revalidatePath(...a),
  revalidateTag: (...a: unknown[]) => revalidateTag(...a),
}));

const { revalidatePublic, revalidateStock } = await import("./cache");
const {
  CACHE_TAG_CATALOG,
  CACHE_TAG_LEADERBOARD,
  CACHE_TAG_STOCK,
  CACHE_TAG_TAXONOMY,
} = await import("./cache-tags");

beforeEach(() => {
  revalidatePath.mockReset();
  revalidateTag.mockReset();
});

const paths = () => revalidatePath.mock.calls.map((c) => c[0] as string);

describe("revalidateStock — scope-гүй (cron)", () => {
  it("өмнөх өргөн хүрээ: каталог, барааны ба багцын хуудас бүр", () => {
    revalidateStock();
    expect(revalidateTag.mock.calls).toEqual([
      [CACHE_TAG_STOCK, "max"],
      [CACHE_TAG_LEADERBOARD, "max"],
      [CACHE_TAG_CATALOG, "max"],
    ]);
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
    for (const p of ["/blog", "/faq", "/about", "/contact"]) {
      expect(paths().some((x) => x.startsWith(p))).toBe(false);
    }
  });
});

describe("revalidateStock — scope-той (захиалга)", () => {
  it("зөвхөн тэр захиалгын бараа, багц + нүүр, үлдэгдэл ба leaderboard tag", () => {
    revalidateStock({
      productSlugs: ["a", "b", "a"],
      collectionSlugs: ["set-1"],
    });
    expect(revalidateTag.mock.calls).toEqual([
      [CACHE_TAG_STOCK, "max"],
      [CACHE_TAG_LEADERBOARD, "max"],
    ]);
    expect(revalidatePath.mock.calls).toEqual([
      ["/"],
      ["/products/a"],
      ["/products/b"],
      ["/collections"],
      ["/collections/set-1"],
    ]);
  });

  it("каталогийн tag-ийг цэвэрлэхгүй — савны түгжээгээр дамжин бүх барааны хуудсыг дахин бичүүлнэ", () => {
    revalidateStock({ productSlugs: ["a"] });
    expect(revalidateTag).not.toHaveBeenCalledWith(CACHE_TAG_CATALOG, "max");
    expect(revalidatePath).not.toHaveBeenCalledWith("/products/[slug]", "page");
    expect(revalidatePath).not.toHaveBeenCalledWith(
      "/collections/[slug]",
      "page",
    );
  });

  it("багц хөндөөгүй бол багцын жагсаалтыг ч цэвэрлэхгүй", () => {
    revalidateStock({ productSlugs: ["a"], collectionSlugs: [] });
    expect(paths()).toEqual(["/", "/products/a"]);
  });

  it("хоосон scope ч нүүр ба үлдэгдлийн tag-ийг цэвэрлэнэ", () => {
    revalidateStock({});
    expect(paths()).toEqual(["/"]);
    expect(revalidateTag).toHaveBeenCalledWith(CACHE_TAG_STOCK, "max");
  });
});

describe("revalidatePublic", () => {
  it("админы бичилт бүх сайтыг цэвэрлэсээр", () => {
    revalidatePublic();
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });
});

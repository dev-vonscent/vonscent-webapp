import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Хуудасны 404 шалгалт `layout.tsx`-д — хажуугийн `loading.tsx`-ийн
 * Suspense-ээс ДЭЭР, эс бөгөөс `notFound()` 200 статустай гардаг. Энд
 * layout бүр нөхцөл биелэхгүй үед `notFound()` шиддэгийг, биелэхэд
 * children-ээ буцаадгийг шалгана. Статус өөрөө: `e2e/not-found.spec.ts`.
 */

class NotFound extends Error {}
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new NotFound();
  },
}));

const enabled = new Set<string>();
vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: async (key: string) => enabled.has(key),
}));
let product: unknown = null;
vi.mock("@/features/products/api", () => ({
  getProductPageBySlug: async () => product,
}));
let collection: unknown = null;
vi.mock("@/features/collections/api", () => ({
  getCollectionBySlug: async () => collection,
}));
let extra: unknown = null;
const getShopExtra = vi.fn(async () => extra);
vi.mock("@/features/extras/api", () => ({
  getShopExtra: () => getShopExtra(),
}));

const { default: LuckyWheelLayout } = await import("./lucky-wheel/layout");
const { default: RequestLayout } = await import("./request/layout");
const { default: ProductLayout } = await import("./products/[slug]/layout");
const { default: CollectionLayout } =
  await import("./collections/[slug]/layout");
const { default: ExtraLayout } = await import("./extras/[slug]/layout");
const { default: AboutLayout } = await import("./about/layout");
const { default: BlogLayout } = await import("./blog/layout");

const children = "page";
const params = Promise.resolve({ slug: "x" });

beforeEach(() => {
  enabled.clear();
  product = null;
  collection = null;
  extra = null;
  getShopExtra.mockClear();
});

describe("туг хаалттай → notFound", () => {
  it.each([
    ["lucky_wheel", LuckyWheelLayout],
    ["perfume_requests", RequestLayout],
  ] as const)("%s", async (flag, Layout) => {
    await expect(Layout({ children })).rejects.toBeInstanceOf(NotFound);
    enabled.add(flag);
    await expect(Layout({ children })).resolves.toBe(children);
  });
});

describe("байхгүй slug → notFound", () => {
  it("бараа", async () => {
    await expect(ProductLayout({ children, params })).rejects.toBeInstanceOf(
      NotFound,
    );
    product = { slug: "x" };
    await expect(ProductLayout({ children, params })).resolves.toBe(children);
  });

  it("багц", async () => {
    await expect(CollectionLayout({ children, params })).rejects.toBeInstanceOf(
      NotFound,
    );
    collection = { slug: "x" };
    await expect(CollectionLayout({ children, params })).resolves.toBe(
      children,
    );
  });
});

describe("нэмэлт бараа (extras_shop)", () => {
  it("туг хаалттай → notFound, санг асуухгүй", async () => {
    extra = { card: {} };
    await expect(ExtraLayout({ children, params })).rejects.toBeInstanceOf(
      NotFound,
    );
    expect(getShopExtra).not.toHaveBeenCalled();
  });

  it("байхгүй slug → notFound, байвал children", async () => {
    enabled.add("extras_shop");
    await expect(ExtraLayout({ children, params })).rejects.toBeInstanceOf(
      NotFound,
    );
    extra = { card: {} };
    await expect(ExtraLayout({ children, params })).resolves.toBe(children);
  });
});

describe("нуугдсан контент (CONTENT_PAGES_HIDDEN) → notFound", () => {
  it.each([AboutLayout, BlogLayout])("%#", (Layout) => {
    expect(() => Layout({ children })).toThrow(NotFound);
  });
});

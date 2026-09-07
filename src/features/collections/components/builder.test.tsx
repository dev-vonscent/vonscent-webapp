import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CollectionBuilder } from "./builder";
import { DEFAULT_COLLECTION_SETTINGS, type BuilderProduct } from "../types";

/**
 * Since the builder moved its filtering, sorting and paging to the server
 * (0064), the product grid is only ONE page — so the selection can no longer
 * live as a list of ids matched against an in-memory catalogue. It holds the
 * whole picked product instead, and that is what these tests pin down: a page
 * or filter change must not quietly empty the tray.
 *
 * Changing the page is modelled as new `products` props on the same mounted
 * component, which is exactly what a soft navigation to `?page=2` does.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/collections/build",
}));

vi.mock("@/features/cart/store", () => ({
  useCart: (select: (s: { addCollection: () => void }) => unknown) =>
    select({ addCollection: vi.fn() }),
}));

// The catalogue controls are covered by their own tests; here they would only
// drag Radix sliders and selects into a test about selection state.
vi.mock("@/features/catalog/components/catalog-filters", () => ({
  CatalogFilters: () => null,
}));
vi.mock("@/features/catalog/components/catalog-filter-sheet", () => ({
  CatalogFilterSheet: () => null,
}));
vi.mock("@/features/catalog/components/catalog-sort", () => ({
  CatalogSort: () => null,
}));
vi.mock("@/features/catalog/components/catalog-search", () => ({
  CatalogSearch: () => null,
}));
vi.mock("@/features/catalog/components/catalog-pagination", () => ({
  CatalogPagination: () => null,
}));

function product(id: string, over: Partial<BuilderProduct> = {}): BuilderProduct {
  return {
    productId: id,
    slug: id,
    name: id,
    brand: `Brand ${id}`,
    gender: "unisex",
    image: null,
    soldOut: false,
    availableMl: 200,
    variantByMl: {
      5: { variantId: `${id}-5`, price: 19000, inStock: true },
      10: { variantId: `${id}-10`, price: 32000, inStock: true },
    },
    scentFamilies: [],
    seasons: [],
    tags: [],
    startingPrice: 19000,
    createdAt: "2026-01-01T00:00:00Z",
    ratingCount: 0,
    ...over,
  };
}

const PAGE_ONE = [product("Sauvage"), product("Bleu")];
const PAGE_TWO = [product("Aventus"), product("Oud")];

function renderBuilder(products: BuilderProduct[]) {
  return render(
    <CollectionBuilder
      products={products}
      total={4}
      page={1}
      perPage={2}
      settings={DEFAULT_COLLECTION_SETTINGS}
      isLoggedIn={false}
      brands={[]}
      brandLogos={{}}
      priceBounds={{ min: 0, max: 100000 }}
      families={[]}
    />,
  );
}

/** The tray renders one chip per pick, labelled «<brand> <name> хасах». */
const chip = (p: BuilderProduct) => `${p.brand} ${p.name} хасах`;

describe("CollectionBuilder selection", () => {
  it("keeps a pick that the next page does not contain", async () => {
    const user = userEvent.setup();
    const { rerender } = renderBuilder(PAGE_ONE);

    await user.click(screen.getAllByRole("button", { name: "Нэмэх" })[0]);
    expect(screen.getByLabelText(chip(PAGE_ONE[0]))).toBeInTheDocument();

    // Page 2: the picked scent is not among the rendered products any more.
    rerender(
      <CollectionBuilder
        products={PAGE_TWO}
        total={4}
        page={2}
        perPage={2}
        settings={DEFAULT_COLLECTION_SETTINGS}
        isLoggedIn={false}
        brands={[]}
        brandLogos={{}}
        priceBounds={{ min: 0, max: 100000 }}
        families={[]}
      />,
    );

    // Still selected, and still named — the tray carries the product, not an
    // id it would have to look up in a catalogue it no longer has.
    expect(screen.getByLabelText(chip(PAGE_ONE[0]))).toBeInTheDocument();
    expect(screen.getByText("Brand Aventus")).toBeInTheDocument();
  });

  it("accumulates picks made on different pages", async () => {
    const user = userEvent.setup();
    const { rerender } = renderBuilder(PAGE_ONE);
    await user.click(screen.getAllByRole("button", { name: "Нэмэх" })[0]);

    rerender(
      <CollectionBuilder
        products={PAGE_TWO}
        total={4}
        page={2}
        perPage={2}
        settings={DEFAULT_COLLECTION_SETTINGS}
        isLoggedIn={false}
        brands={[]}
        brandLogos={{}}
        priceBounds={{ min: 0, max: 100000 }}
        families={[]}
      />,
    );
    await user.click(screen.getAllByRole("button", { name: "Нэмэх" })[0]);

    expect(screen.getByLabelText(chip(PAGE_ONE[0]))).toBeInTheDocument();
    expect(screen.getByLabelText(chip(PAGE_TWO[0]))).toBeInTheDocument();
  });

  it("flags a pick the chosen size cannot fill instead of dropping it", async () => {
    const user = userEvent.setup();
    // In stock at 5ml, gone at 10ml.
    const only5 = product("Tobacco", {
      variantByMl: {
        5: { variantId: "t-5", price: 19000, inStock: true },
        10: { variantId: "t-10", price: 32000, inStock: false },
      },
    });
    renderBuilder([only5]);

    await user.click(screen.getByRole("button", { name: "Нэмэх" }));
    await user.click(screen.getByRole("button", { name: "10ml" }));

    // Still in the tray, and the shopper is told which one and why.
    expect(screen.getByLabelText(chip(only5))).toBeInTheDocument();
    expect(
      screen.getByText(/Эдгээр үнэртэн 10ml хэмжээгээр одоогоор байхгүй/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /10ml-д байхгүй/ }),
    ).toBeDisabled();
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CatalogPagination } from "./catalog-pagination";
import { FilterQueryProvider } from "./use-filter-query";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/catalog",
  useSearchParams: () => new URLSearchParams("q=dior"),
}));

/** Paging shares the catalog's filter state, so it needs the provider. */
function renderPager(props: React.ComponentProps<typeof CatalogPagination>) {
  return render(
    <FilterQueryProvider>
      <CatalogPagination {...props} />
    </FilterQueryProvider>,
  );
}

describe("CatalogPagination", () => {
  beforeEach(() => replace.mockClear());

  it("renders nothing for a single page", () => {
    const { container } = renderPager({ page: 1, perPage: 24, total: 10 });
    expect(container).toBeEmptyDOMElement();
  });

  it("truncates long page lists with ellipses", () => {
    renderPager({ page: 20, perPage: 1, total: 40 });
    expect(screen.getAllByText("…")).toHaveLength(2);
    // 1 2 … 19 20 21 … 39 40 + prev/next
    expect(screen.getAllByRole("button")).toHaveLength(9);
  });

  it("navigates keeping existing query params", async () => {
    renderPager({ page: 1, perPage: 1, total: 5 });
    await userEvent.click(screen.getByRole("button", { name: "3" }));
    expect(replace).toHaveBeenCalledWith("/catalog?q=dior&page=3", {
      scroll: true,
    });
  });

  it("drops the page param when returning to the first page", async () => {
    renderPager({ page: 2, perPage: 1, total: 5 });
    await userEvent.click(screen.getByRole("button", { name: "Өмнөх" }));
    expect(replace).toHaveBeenCalledWith("/catalog?q=dior", { scroll: true });
  });
});

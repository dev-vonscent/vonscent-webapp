import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CatalogPagination } from "./catalog-pagination";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/catalog",
  useSearchParams: () => new URLSearchParams("q=dior"),
}));

describe("CatalogPagination", () => {
  beforeEach(() => push.mockClear());

  it("renders nothing for a single page", () => {
    const { container } = render(
      <CatalogPagination page={1} perPage={24} total={10} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("truncates long page lists with ellipses", () => {
    render(<CatalogPagination page={20} perPage={1} total={40} />);
    expect(screen.getAllByText("…")).toHaveLength(2);
    // 1 2 … 19 20 21 … 39 40 + prev/next
    expect(screen.getAllByRole("button")).toHaveLength(9);
  });

  it("navigates keeping existing query params", async () => {
    render(<CatalogPagination page={1} perPage={1} total={5} />);
    await userEvent.click(screen.getByRole("button", { name: "3" }));
    expect(push).toHaveBeenCalledWith("/catalog?q=dior&page=3", {
      scroll: true,
    });
  });
});

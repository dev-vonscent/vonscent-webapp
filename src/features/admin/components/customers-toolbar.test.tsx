import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CustomersToolbar } from "./customers-toolbar";

const replace = vi.fn();
let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => searchParams,
}));

/**
 * Two behaviours, both of which were bugs on this screen: the search used to
 * need Enter, and the empty state's «Бүх хэрэглэгч харах» link looked broken
 * because the field kept its text and the debounce put the filter straight
 * back on 300ms after the link cleared it.
 */
describe("CustomersToolbar", () => {
  beforeEach(() => {
    replace.mockClear();
    searchParams = new URLSearchParams();
  });

  const field = () => screen.getByRole("searchbox");

  it("searches while typing, without Enter", async () => {
    const user = userEvent.setup();
    render(<CustomersToolbar />);
    await user.type(field(), "9911");
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/admin/customers?q=9911"),
    );
  });

  it("drops the page when a new search starts", async () => {
    const user = userEvent.setup();
    searchParams = new URLSearchParams("page=3");
    render(<CustomersToolbar />);
    await user.type(field(), "болд");
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(
        `/admin/customers?q=${encodeURIComponent("болд")}`,
      ),
    );
  });

  it("clears the field when ?q= is dropped from outside", async () => {
    searchParams = new URLSearchParams("q=болд");
    const { rerender } = render(<CustomersToolbar />);
    expect(field()).toHaveValue("болд");

    // What «Бүх хэрэглэгч харах» does: navigate to the bare path.
    searchParams = new URLSearchParams();
    rerender(<CustomersToolbar />);
    expect(field()).toHaveValue("");

    // And the debounce must not put the filter back on.
    await new Promise((r) => setTimeout(r, 400));
    expect(replace).not.toHaveBeenCalled();
  });

  it("does not fight the operator over a trailing space", async () => {
    const user = userEvent.setup();
    render(<CustomersToolbar />);
    await user.type(field(), "болд ");
    await waitFor(() => expect(replace).toHaveBeenCalled());
    // Our own push carries the trimmed term; the field keeps what was typed.
    searchParams = new URLSearchParams("q=болд");
    expect(field()).toHaveValue("болд ");
  });
});

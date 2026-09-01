import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BrandSelect } from "./brand-select";
import type { BrandOption } from "@/lib/types";

const adminFetch = vi.fn();
vi.mock("@/features/admin/lib/mutate", () => ({
  adminFetch: (...args: unknown[]) => adminFetch(...args),
}));

function brand(name: string, over: Partial<BrandOption> = {}): BrandOption {
  return {
    id: name.toLowerCase(),
    slug: name.toLowerCase(),
    name,
    logoUrl: null,
    sortOrder: 0,
    isActive: true,
    ...over,
  };
}

const BRANDS = [brand("Chanel"), brand("Dior")];

describe("BrandSelect", () => {
  beforeEach(() => adminFetch.mockReset());

  it("falls back to a text input when there are no brands (demo mode)", async () => {
    const onChange = vi.fn();
    render(<BrandSelect value="" onChange={onChange} brands={[]} />);
    const input = screen.getByPlaceholderText("Dior");
    await userEvent.type(input, "X");
    expect(onChange).toHaveBeenCalledWith("X");
  });

  it("keeps showing a brand that is no longer in the active list", () => {
    // A product on a retired brand must not silently lose it on edit.
    render(
      <BrandSelect value="Retired House" onChange={vi.fn()} brands={BRANDS} />,
    );
    expect(screen.getByRole("combobox")).toHaveTextContent("Retired House");
  });

  it("offers «add brand» as an action, not a selectable option", async () => {
    const user = userEvent.setup();
    render(<BrandSelect value="Dior" onChange={vi.fn()} brands={BRANDS} />);
    await user.click(screen.getByRole("combobox"));

    const add = screen.getByRole("button", { name: /Шинэ брэнд нэмэх/ });
    // Not an option: it cannot be arrowed onto, typeahead-matched, or —
    // because the value would round-trip into products.brand — saved.
    expect(
      screen.queryByRole("option", { name: /Шинэ брэнд нэмэх/ }),
    ).toBeNull();
    // Pinned above the brands rather than trailing them.
    const firstOption = screen.getAllByRole("option")[0];
    expect(add.compareDocumentPosition(firstOption)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("creates a brand from the dialog, name only, and selects it", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    adminFetch.mockResolvedValue({
      ok: true,
      data: { brand: brand("Byredo", { id: "new-id" }) },
    });

    render(<BrandSelect value="Dior" onChange={onChange} brands={BRANDS} />);
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("button", { name: /Шинэ брэнд нэмэх/ }));

    await user.type(screen.getByLabelText("Нэр"), "Byredo");
    await user.click(screen.getByRole("button", { name: "Нэмэх" }));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith("Byredo"));
    const [, init] = adminFetch.mock.calls[0] as [string, RequestInit];
    // Name only — the logo belongs to the Брэнд page, not the product form.
    expect(JSON.parse(String(init.body))).toEqual({ name: "Byredo" });
  });

  it("selects the existing brand instead of creating a duplicate", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<BrandSelect value="" onChange={onChange} brands={BRANDS} />);
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("button", { name: /Шинэ брэнд нэмэх/ }));
    // Different casing — the slip this whole table exists to prevent.
    await user.type(screen.getByLabelText("Нэр"), "chanel");

    await user.click(screen.getByRole("button", { name: "Сонгох" }));
    expect(onChange).toHaveBeenCalledWith("Chanel");
    expect(adminFetch).not.toHaveBeenCalled();
  });
});

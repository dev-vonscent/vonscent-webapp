import * as React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CustomTagField } from "./custom-tag-field";
import type { CustomTagOption } from "@/features/taxonomy/api";

const adminFetch = vi.fn();
vi.mock("@/features/admin/lib/mutate", () => ({
  adminFetch: (...args: unknown[]) => adminFetch(...args),
}));
vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
const confirm = vi.fn().mockResolvedValue(true);
vi.mock("@/components/shared/confirm-dialog", () => ({
  useConfirm: () => [confirm, null],
}));

const POOL: CustomTagOption[] = [
  { id: "1", name: "Оффис", slug: "office" },
  { id: "2", name: "Ваниль", slug: "vanil" },
];

/** Drives the field the way a product form does: it owns the selection. */
function Harness({ initial = ["vanil"] }: { initial?: string[] }) {
  const [selected, setSelected] = React.useState(initial);
  const toggle = (slug: string) =>
    setSelected((p) =>
      p.includes(slug) ? p.filter((s) => s !== slug) : [...p, slug],
    );
  return (
    <>
      <CustomTagField pool={POOL} selected={selected} onToggle={toggle} />
      <output data-testid="selected">{selected.join(",")}</output>
    </>
  );
}

describe("CustomTagField", () => {
  beforeEach(() => {
    adminFetch.mockReset();
    confirm.mockClear().mockResolvedValue(true);
  });

  it("carries a ticked tag across a rename that changes its slug", async () => {
    const user = userEvent.setup();
    adminFetch.mockResolvedValue({
      ok: true,
      data: { tag: { id: "2", name: "Ваниль тос", slug: "vanil-tos" } },
    });

    render(<Harness initial={["vanil"]} />);
    await user.click(screen.getByRole("button", { name: /Ваниль — үйлдэл/ }));
    await user.click(screen.getByRole("menuitem", { name: "Засах" }));
    const input = await screen.findByLabelText("Нэр");
    await user.clear(input);
    await user.type(input, "Ваниль тос");
    await user.click(screen.getByRole("button", { name: "Хадгалах" }));

    // The selection is a list of slugs, so it has to move with the rename or
    // the save silently drops the tag.
    await waitFor(() =>
      expect(screen.getByTestId("selected")).toHaveTextContent("vanil-tos"),
    );
  });

  it("un-ticks a tag that gets deleted", async () => {
    const user = userEvent.setup();
    adminFetch.mockResolvedValue({ ok: true, data: {} });

    render(<Harness initial={["vanil"]} />);
    await user.click(screen.getByRole("button", { name: /Ваниль — үйлдэл/ }));
    await user.click(screen.getByRole("menuitem", { name: "Устгах" }));

    await waitFor(() =>
      expect(screen.getByTestId("selected")).toHaveTextContent(""),
    );
    expect(screen.queryByText("Ваниль")).toBeNull();
  });

  it("ticks a tag added from the input", async () => {
    const user = userEvent.setup();
    adminFetch.mockResolvedValue({
      ok: true,
      data: { tag: { id: "3", name: "Уд", slug: "ud" } },
    });

    render(<Harness initial={[]} />);
    await user.type(screen.getByLabelText("Шинэ нэмэлт таг"), "Уд");
    await user.click(screen.getByRole("button", { name: "Таг нэмэх" }));

    await waitFor(() =>
      expect(screen.getByTestId("selected")).toHaveTextContent("ud"),
    );
  });
});

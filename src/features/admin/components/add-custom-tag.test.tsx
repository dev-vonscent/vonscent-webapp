import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AddCustomTag } from "./add-custom-tag";

const adminFetch = vi.fn();
vi.mock("@/features/admin/lib/mutate", () => ({
  adminFetch: (...args: unknown[]) => adminFetch(...args),
}));

const POOL = [{ id: "1", name: "Оффис", slug: "office" }];

describe("AddCustomTag", () => {
  beforeEach(() => adminFetch.mockReset());

  it("creates a tag and hands it back to be selected", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    const tag = { id: "2", name: "Ваниль", slug: "vanil" };
    adminFetch.mockResolvedValue({ ok: true, data: { tag } });

    render(<AddCustomTag pool={POOL} onCreated={onCreated} />);
    await user.type(screen.getByLabelText("Шинэ нэмэлт таг"), "Ваниль");
    await user.click(screen.getByRole("button", { name: "Таг нэмэх" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(tag));
    const [url, init] = adminFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/admin/custom-tags");
    expect(JSON.parse(String(init.body))).toEqual({ name: "Ваниль" });
    // Cleared, so the next tag can be typed straight away.
    expect(screen.getByLabelText("Шинэ нэмэлт таг")).toHaveValue("");
  });

  it("shows a spinner on the button while the request is in flight", async () => {
    const user = userEvent.setup();
    let release!: (v: unknown) => void;
    adminFetch.mockReturnValue(new Promise((r) => (release = r)));

    render(<AddCustomTag pool={POOL} onCreated={vi.fn()} />);
    await user.type(screen.getByLabelText("Шинэ нэмэлт таг"), "Уд");
    const button = screen.getByRole("button", { name: "Таг нэмэх" });
    await user.click(button);

    await waitFor(() =>
      expect(button.querySelector(".animate-spin")).not.toBeNull(),
    );
    release({ ok: true, data: { tag: { id: "9", name: "Уд", slug: "ud" } } });
    await waitFor(() =>
      expect(button.querySelector(".animate-spin")).toBeNull(),
    );
  });

  it("selects the existing tag instead of creating a duplicate", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();

    render(<AddCustomTag pool={POOL} onCreated={onCreated} />);
    await user.type(screen.getByLabelText("Шинэ нэмэлт таг"), "оффис");
    await user.click(screen.getByRole("button", { name: "Таг нэмэх" }));

    expect(onCreated).toHaveBeenCalledWith(POOL[0]);
    expect(adminFetch).not.toHaveBeenCalled();
  });

  it("submits on Enter without letting the product form save", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    adminFetch.mockResolvedValue({
      ok: true,
      data: { tag: { id: "3", name: "Уд", slug: "ud" } },
    });

    // The control lives inside the product form; Enter must not reach it.
    render(
      <form onSubmit={onSubmit}>
        <AddCustomTag pool={POOL} onCreated={vi.fn()} />
      </form>,
    );
    await user.type(screen.getByLabelText("Шинэ нэмэлт таг"), "Уд{Enter}");

    await waitFor(() => expect(adminFetch).toHaveBeenCalled());
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

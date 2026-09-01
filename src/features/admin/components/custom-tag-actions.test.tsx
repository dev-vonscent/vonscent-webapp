import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CustomTagActions } from "./custom-tag-actions";

const adminFetch = vi.fn();
vi.mock("@/features/admin/lib/mutate", () => ({
  adminFetch: (...args: unknown[]) => adminFetch(...args),
}));
vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
// Auto-accept, so the delete path is exercised rather than the dialog.
const confirm = vi.fn().mockResolvedValue(true);
vi.mock("@/components/shared/confirm-dialog", () => ({
  useConfirm: () => [confirm, null],
}));

const TAG = { id: "t1", name: "Ваниль", slug: "vanil" };

describe("CustomTagActions", () => {
  beforeEach(() => {
    adminFetch.mockReset();
    confirm.mockClear().mockResolvedValue(true);
  });

  it("renames through PATCH and reports the new tag", async () => {
    const user = userEvent.setup();
    const onRenamed = vi.fn();
    const renamed = { id: "t1", name: "Ваниль тос", slug: "vanil-tos" };
    adminFetch.mockResolvedValue({ ok: true, data: { tag: renamed } });

    render(
      <CustomTagActions tag={TAG} onRenamed={onRenamed} onDeleted={vi.fn()} />,
    );
    await user.click(screen.getByRole("button", { name: /үйлдэл/ }));
    await user.click(screen.getByRole("menuitem", { name: "Засах" }));

    const input = await screen.findByLabelText("Нэр");
    await user.clear(input);
    await user.type(input, "Ваниль тос");
    await user.click(screen.getByRole("button", { name: "Хадгалах" }));

    await waitFor(() => expect(onRenamed).toHaveBeenCalledWith(renamed));
    const [url, init] = adminFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/admin/custom-tags/t1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(String(init.body))).toEqual({ name: "Ваниль тос" });
  });

  it("asks before deleting, then deletes", async () => {
    const user = userEvent.setup();
    const onDeleted = vi.fn();
    adminFetch.mockResolvedValue({ ok: true, data: {} });

    render(
      <CustomTagActions tag={TAG} onRenamed={vi.fn()} onDeleted={onDeleted} />,
    );
    await user.click(screen.getByRole("button", { name: /үйлдэл/ }));
    await user.click(screen.getByRole("menuitem", { name: "Устгах" }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(TAG));
    // The pool is shared, so the warning has to come first.
    expect(confirm).toHaveBeenCalled();
    const [url, init] = adminFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/admin/custom-tags/t1");
    expect(init.method).toBe("DELETE");
  });

  it("does not delete when the confirmation is declined", async () => {
    const user = userEvent.setup();
    const onDeleted = vi.fn();
    confirm.mockResolvedValue(false);

    render(
      <CustomTagActions tag={TAG} onRenamed={vi.fn()} onDeleted={onDeleted} />,
    );
    await user.click(screen.getByRole("button", { name: /үйлдэл/ }));
    await user.click(screen.getByRole("menuitem", { name: "Устгах" }));

    await waitFor(() => expect(confirm).toHaveBeenCalled());
    expect(adminFetch).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
  });
});

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mutateJson = vi.fn();
vi.mock("@/features/admin/lib/mutate", () => ({
  mutateJson: (...args: unknown[]) => mutateJson(...args),
}));
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }),
}));

import { OrderAdminNote } from "./order-detail-actions";

beforeEach(() => {
  mutateJson.mockReset();
  refresh.mockReset();
});

describe("OrderAdminNote (task 13)", () => {
  it("тэмдэглэлгүй үед trigger нь тэмдэглэлгүйг хэлнэ, хуудсанд textarea байхгүй", () => {
    render(<OrderAdminNote orderId="o1" initial="" updatedAt={null} />);
    expect(
      screen.getByRole("button", { name: "Админы тэмдэглэл" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("тэмдэглэлтэй үед trigger нь тэмдэглэлтэйг хэлнэ", () => {
    render(
      <OrderAdminNote orderId="o1" initial="Хороо зассан" updatedAt={null} />,
    );
    expect(
      screen.getByRole("button", { name: "Админы тэмдэглэл (тэмдэглэлтэй)" }),
    ).toBeInTheDocument();
  });

  it("dialog нээгээд хадгална", async () => {
    mutateJson.mockResolvedValue(true);
    const user = userEvent.setup();
    render(<OrderAdminNote orderId="o1" initial="" updatedAt={null} />);
    await user.click(screen.getByRole("button", { name: "Админы тэмдэглэл" }));
    await user.type(
      await screen.findByRole("textbox", { name: "Админы тэмдэглэл" }),
      "Утсаар хүлээж авна",
    );
    await user.click(screen.getByRole("button", { name: "Хадгалах" }));
    await waitFor(() =>
      expect(mutateJson).toHaveBeenCalledWith(
        "/api/admin/orders/o1/note",
        "PUT",
        { note: "Утсаар хүлээж авна" },
        expect.any(String),
      ),
    );
    expect(refresh).toHaveBeenCalled();
  });
});

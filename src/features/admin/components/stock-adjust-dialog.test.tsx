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

import { StockAdjustDialog } from "./stock-adjust-dialog";

function setup(props: { comingSoon?: boolean; onLaunched?: () => void }) {
  const onOpenChange = vi.fn();
  render(
    <StockAdjustDialog
      open
      onOpenChange={onOpenChange}
      mode="restock"
      productId="p1"
      productLabel="Creed — Aventus"
      productName="Aventus"
      onHandMl={0}
      reservedMl={0}
      {...props}
    />,
  );
  return { onOpenChange };
}

async function restock(ml: string) {
  await userEvent.type(screen.getByLabelText("Нэмэх хэмжээ (ml)"), ml);
  await userEvent.click(screen.getByRole("button", { name: "Нөөц нэмэх" }));
}

describe("StockAdjustDialog — «Тун удахгүй» бараа (0125)", () => {
  beforeEach(() => {
    mutateJson.mockReset().mockResolvedValue(true);
    refresh.mockReset();
  });

  it("нөөц нэмсний дараа хаагдахгүй, худалдаанд гаргах эсэхийг асууна", async () => {
    const onLaunched = vi.fn();
    const { onOpenChange } = setup({ comingSoon: true, onLaunched });
    await restock("100");

    expect(await screen.findByText("Худалдаанд гаргах уу?")).toBeTruthy();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);

    await userEvent.click(
      screen.getByRole("button", { name: "Худалдаанд гаргах" }),
    );
    await waitFor(() => expect(onLaunched).toHaveBeenCalled());
    expect(mutateJson).toHaveBeenLastCalledWith(
      "/api/admin/products/p1/launch",
      "POST",
      {},
      expect.any(String),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("«Дараа» дарвал гаргахгүйгээр хаана", async () => {
    const { onOpenChange } = setup({ comingSoon: true });
    await restock("100");
    await userEvent.click(await screen.findByRole("button", { name: "Дараа" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    // Зөвхөн нөөц нэмэх хүсэлт — launch явсангүй.
    expect(mutateJson).toHaveBeenCalledTimes(1);
    expect(mutateJson.mock.calls[0][0]).toBe("/api/admin/inventory");
  });

  it("гаргахад алдаа гарвал цонх нээлттэй үлдэнэ", async () => {
    const onLaunched = vi.fn();
    const { onOpenChange } = setup({ comingSoon: true, onLaunched });
    await restock("100");
    mutateJson.mockResolvedValueOnce(false);
    await userEvent.click(
      await screen.findByRole("button", { name: "Худалдаанд гаргах" }),
    );

    await waitFor(() => expect(mutateJson).toHaveBeenCalledTimes(2));
    expect(onLaunched).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByText("Худалдаанд гаргах уу?")).toBeTruthy();
  });

  it("энгийн бараанд асуулгүй шууд хаана", async () => {
    const { onOpenChange } = setup({});
    await restock("50");

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(screen.queryByText("Худалдаанд гаргах уу?")).toBeNull();
  });
});

describe("StockAdjustDialog — залруулга, «Өөр суваг»", () => {
  beforeEach(() => {
    mutateJson.mockReset().mockResolvedValue(true);
    refresh.mockReset();
  });

  function setupCorrection() {
    render(
      <StockAdjustDialog
        open
        onOpenChange={vi.fn()}
        mode="correction"
        productId="p1"
        productLabel="Creed — Aventus"
        onHandMl={100}
        reservedMl={0}
      />,
    );
  }

  async function removeMl(ml: string) {
    await userEvent.type(screen.getByLabelText("Хасах хэмжээ (ml)"), ml);
    await userEvent.click(
      screen.getByRole("button", { name: "Үлдэгдэл хасах" }),
    );
    await waitFor(() => expect(mutateJson).toHaveBeenCalled());
    return mutateJson.mock.calls[0][2] as { reason: string; delta: number };
  }

  it("чөлөөт тайлбарын оронд Zary / Чат гарна, өгөгдмөл нь Zary", async () => {
    setupCorrection();
    expect(screen.queryByLabelText("Тайлбар (сонголтоор)")).toBeNull();
    expect(
      screen.getByRole("radio", { name: "Zary" }).getAttribute("aria-checked"),
    ).toBe("true");

    const body = await removeMl("20");
    expect(body).toMatchObject({ delta: -20, reason: "sold-elsewhere: Zary" });
  });

  it("Чат сонговол сувгийг хадгална", async () => {
    setupCorrection();
    await userEvent.click(screen.getByRole("radio", { name: "Чат" }));

    const body = await removeMl("5");
    expect(body.reason).toBe("sold-elsewhere: Чат");
  });
});

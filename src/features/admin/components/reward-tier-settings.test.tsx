import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RewardTierSettings } from "./reward-tier-settings";
import type { RewardTier } from "@/lib/validators/coupon";

const saveSetting = vi.fn();
vi.mock("@/features/admin/lib/mutate", () => ({
  saveSetting: (...a: unknown[]) => saveSetting(...a),
}));

const TIER: RewardTier = {
  id: "t1",
  enabled: true,
  minTotal: 100_000,
  type: "percent",
  value: 5,
  validDays: 30,
  maxUsesPerUser: 1,
};

const confirmTitle = /Өөрчлөлтөө хадгалахгүй гарах уу/;

describe("RewardTierSettings drawer", () => {
  beforeEach(() => saveSetting.mockReset());

  async function openAndAddTier() {
    const user = userEvent.setup();
    render(<RewardTierSettings initial={[TIER]} />);
    await user.click(screen.getByRole("button", { name: /Шатлал тохируулах/ }));
    await user.click(screen.getByRole("button", { name: /Шатлал нэмэх/ }));
    return user;
  }

  it("өөрчлөлтгүй бол «Болих» шууд хаана", async () => {
    const user = userEvent.setup();
    render(<RewardTierSettings initial={[TIER]} />);
    await user.click(screen.getByRole("button", { name: /Шатлал тохируулах/ }));
    await user.click(screen.getByRole("button", { name: "Болих" }));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /Шатлал нэмэх/ })).toBeNull(),
    );
    expect(screen.queryByText(confirmTitle)).toBeNull();
  });

  it("шатлал нэмээд «Болих» → нэг л удаа асууж, зөвшөөрвөл хаагдана", async () => {
    const user = await openAndAddTier();
    await user.click(screen.getByRole("button", { name: "Болих" }));
    expect(await screen.findAllByText(confirmTitle)).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Хадгалахгүй гарах" }));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /Шатлал нэмэх/ })).toBeNull(),
    );
    // Хаагдсаны дараа асуулт дахин гарах ёсгүй.
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText(confirmTitle)).toBeNull();
  });

  it("асуултад «Болих» гэвэл drawer засвартайгаа үлдэнэ", async () => {
    const user = await openAndAddTier();
    await user.click(screen.getByRole("button", { name: "Болих" }));
    const dialog = (await screen.findByText(confirmTitle)).closest(
      "[role=alertdialog],[role=dialog]",
    ) as HTMLElement;
    const cancel = [...dialog.querySelectorAll("button")].find(
      (b) => b.textContent !== "Хадгалахгүй гарах" && b.textContent?.trim(),
    )!;
    await user.click(cancel);
    await waitFor(() => expect(screen.queryByText(confirmTitle)).toBeNull());
    expect(screen.getAllByText(/^Шатлал \d$/)).toHaveLength(2);
  });

  it("Escape → нэг л удаа асууна", async () => {
    const user = await openAndAddTier();
    await user.keyboard("{Escape}");
    expect(await screen.findAllByText(confirmTitle)).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Хадгалахгүй гарах" }));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /Шатлал нэмэх/ })).toBeNull(),
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText(confirmTitle)).toBeNull();
  });

  it("хадгалсны дараа асуулгүй хаагдаж, хураангуй шинэчлэгдэнэ", async () => {
    saveSetting.mockResolvedValue(true);
    const user = await openAndAddTier();
    await user.click(screen.getByRole("button", { name: "Хадгалах" }));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /Шатлал нэмэх/ })).toBeNull(),
    );
    expect(screen.queryByText(confirmTitle)).toBeNull();
    expect(saveSetting).toHaveBeenCalledOnce();
    expect(screen.getByText(/200,000₮\+/)).toBeTruthy();
  });
});

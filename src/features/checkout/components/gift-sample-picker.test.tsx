import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { GiftPool } from "@/features/gifts/use-gift-pool";

const POOL: GiftPool = {
  enabled: true,
  threshold: 200000,
  sampleMl: 1,
  products: [
    { id: "g1", name: "Santal 33", brand: "Le Labo", image: null },
    { id: "g2", name: "Baccarat Rouge", brand: "MFK", image: null },
    { id: "g3", name: "Oud Wood", brand: "Tom Ford", image: null },
  ],
};

let pool: GiftPool | null = POOL;
vi.mock("@/features/gifts/use-gift-pool", () => ({
  useGiftPool: () => pool,
}));
vi.mock("@/lib/toast", () => ({ toast: vi.fn() }));

import { GiftSamplePicker } from "./gift-sample-picker";

function renderPicker(
  over: Partial<React.ComponentProps<typeof GiftSamplePicker>> = {},
) {
  const onChange = vi.fn();
  const utils = render(
    <GiftSamplePicker
      step={3}
      allowance={1}
      goodsAfterDiscount={244200}
      value={[]}
      onChange={onChange}
      {...over}
    />,
  );
  return { ...utils, onChange };
}

describe("GiftSamplePicker", () => {
  it("is a numbered step with a one-line summary", () => {
    renderPicker();
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("Бэлгийн 1 мл дээж")).toBeTruthy();
    // 244,200 → дараагийн эрх 400,000 дээр: 155,800₮ дутуу.
    expect(
      screen.getByText("1 дээж сонгох эрхтэй · 155,800₮ нэмбэл +1"),
    ).toBeTruthy();
    expect(screen.getByText("0/1 сонгосон")).toBeTruthy();
  });

  it("behaves like a radio group with a single allowance", async () => {
    const { onChange, rerender } = renderPicker();
    expect(screen.getByRole("radiogroup")).toBeTruthy();

    await userEvent.click(screen.getByRole("radio", { name: /Santal 33/ }));
    expect(onChange).toHaveBeenLastCalledWith(["g1"]);

    // Өөрийг нь дарвал СОЛИГДОНО — эхлээд хасах шаардлагагүй.
    rerender(
      <GiftSamplePicker
        step={3}
        allowance={1}
        goodsAfterDiscount={244200}
        value={["g1"]}
        onChange={onChange}
      />,
    );
    expect(
      screen
        .getByRole("radio", { name: /Santal 33/ })
        .getAttribute("aria-checked"),
    ).toBe("true");
    await userEvent.click(screen.getByRole("radio", { name: /Oud Wood/ }));
    expect(onChange).toHaveBeenLastCalledWith(["g3"]);
  });

  it("counts picks with several allowances, one water up to the limit", async () => {
    const { onChange } = renderPicker({
      allowance: 3,
      goodsAfterDiscount: 650000,
      value: ["g1"],
    });
    expect(
      screen.getByText(/3 дээж сонгох эрхтэй · .* · нэг уснаас 2 хүртэл/),
    ).toBeTruthy();

    await userEvent.click(
      screen.getByRole("button", { name: /Santal 33 — 1 ширхэг/ }),
    );
    expect(onChange).toHaveBeenLastCalledWith(["g1", "g1"]);

    await userEvent.click(
      screen.getByRole("button", { name: "Santal 33 — нэгээр хасах" }),
    );
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("shows a + on a picked water while a second one is still allowed", () => {
    const { container, rerender, onChange } = renderPicker({
      allowance: 2,
      goodsAfterDiscount: 420000,
      value: ["g1"],
    });
    const tile = screen.getByRole("button", { name: /Santal 33 — 1 ширхэг/ });
    expect(tile.querySelector(".lucide-plus")).toBeTruthy();

    // Хоёулаа авсан — нэмэх зай үлдээгүй тул тэмдэг алга.
    rerender(
      <GiftSamplePicker
        step={3}
        allowance={2}
        goodsAfterDiscount={420000}
        value={["g1", "g1"]}
        onChange={onChange}
      />,
    );
    expect(container.querySelector(".lucide-plus")).toBeNull();
    expect(screen.getByText("2")).toBeTruthy();
  });

  it("dims the rest once every allowance is used", () => {
    renderPicker({
      allowance: 2,
      goodsAfterDiscount: 420000,
      value: ["g1", "g2"],
    });
    expect(
      screen
        .getByRole("button", { name: /Oud Wood — сонгох/ })
        .hasAttribute("disabled"),
    ).toBe(true);
  });

  it("says how far the first gift is when there is none yet", () => {
    renderPicker({ allowance: 0, goodsAfterDiscount: 150000 });
    expect(screen.getByText(/дахиад 50,000₮ дутуу/)).toBeTruthy();
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });

  it("disappears when the pool is off", () => {
    pool = { ...POOL, enabled: false };
    const { container } = renderPicker();
    expect(container.textContent).toBe("");
    pool = POOL;
  });
});

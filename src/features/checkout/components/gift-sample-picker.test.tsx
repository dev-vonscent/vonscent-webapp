import * as React from "react";
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
  it("is a numbered step with the gift rules spelled out", () => {
    renderPicker();
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("Бэлэг")).toBeTruthy();
    expect(
      screen.getByText(
        (_, el) =>
          el?.tagName === "P" &&
          el.textContent === "Захиалгын үнийн дүнгийн 200,000₮ тутамд 1мл",
      ),
    ).toBeTruthy();
    // 244,200 → дараагийн эрх 400,000 дээр: 155,800₮ дутуу.
    expect(
      screen.getByText("Та бэлэгт 1мл үнэртэн сонгох эрхтэй байна."),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Дахиад 155,800₮-ийн бараа нэмснээр 1мл бэлэг нэмэгдэнэ.",
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Купон ашигласан тохиолдолд хямдарсан дүнгээс бодогдоно.",
      ),
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
      screen.getByText("Нэг үнэртнээс дээд тал нь 2 ширхэг сонгох боломжтой."),
    ).toBeTruthy();

    await userEvent.click(
      screen.getByRole("button", { name: "Santal 33 — нэгээр нэмэх" }),
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
    expect(
      screen.getByRole("button", { name: "Santal 33 — нэгээр нэмэх" }),
    ).toBeTruthy();

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
    expect(
      screen.getByText(
        "Дахиад 50,000₮-ийн бараа нэмснээр 1мл бэлэг нэмэгдэнэ.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/сонгох эрхтэй/)).toBeNull();
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });

  describe("7→8 miscount (client, 2026-09 UG)", () => {
    const BIG: GiftPool = {
      ...POOL,
      products: Array.from({ length: 10 }, (_, i) => ({
        id: `p${i + 1}`,
        name: `Water ${i + 1}`,
        brand: "Brand",
        image: null,
      })),
    };

    /** Controlled harness — the page owns `value`, like checkout does. */
    function Harness() {
      const [value, setValue] = React.useState<string[]>([]);
      return (
        <GiftSamplePicker
          step={3}
          allowance={8}
          goodsAfterDiscount={1_600_000}
          value={value}
          onChange={setValue}
        />
      );
    }

    it("lets the 8th distinct water be picked after 7", async () => {
      pool = BIG;
      render(<Harness />);
      for (let i = 1; i <= 7; i += 1) {
        await userEvent.click(
          screen.getByRole("button", { name: new RegExp(`Water ${i} — `) }),
        );
      }
      expect(screen.getByText("7/8 сонгосон")).toBeTruthy();
      const eighth = screen.getByRole("button", { name: /Water 8 — сонгох/ });
      expect(eighth.hasAttribute("disabled")).toBe(false);
      await userEvent.click(eighth);
      expect(screen.getByText("8/8 сонгосон")).toBeTruthy();
      pool = POOL;
    });

    it("does not count a water twice when its tile is tapped again", async () => {
      // Сонгосон хавтсыг дахин товших нь (сонголтоо болих гэж) 2 дахь
      // ширхгийг НЭМДЭГ байсан: 7 ус сонгоход «8/8» болж, 8 дахь усыг
      // сонгох боломжгүй болдог байв.
      pool = BIG;
      render(<Harness />);
      for (let i = 1; i <= 7; i += 1) {
        await userEvent.click(
          screen.getByRole("button", { name: new RegExp(`Water ${i} — `) }),
        );
      }
      await userEvent.click(
        screen.getByRole("button", { name: /Water 7 — 1 ширхэг/ }),
      );
      expect(screen.getByText("6/8 сонгосон")).toBeTruthy();
      expect(
        screen
          .getByRole("button", { name: /Water 8 — сонгох/ })
          .hasAttribute("disabled"),
      ).toBe(false);
      pool = POOL;
    });

    it("adds a second of the same water only through its + button", async () => {
      pool = BIG;
      render(<Harness />);
      await userEvent.click(
        screen.getByRole("button", { name: /Water 1 — сонгох/ }),
      );
      await userEvent.click(
        screen.getByRole("button", { name: "Water 1 — нэгээр нэмэх" }),
      );
      expect(screen.getByText("2/8 сонгосон")).toBeTruthy();
      expect(
        screen.queryByRole("button", { name: "Water 1 — нэгээр нэмэх" }),
      ).toBeNull();
      pool = POOL;
    });
  });

  it("disappears when the pool is off", () => {
    pool = { ...POOL, enabled: false };
    const { container } = renderPicker();
    expect(container.textContent).toBe("");
    pool = POOL;
  });
});

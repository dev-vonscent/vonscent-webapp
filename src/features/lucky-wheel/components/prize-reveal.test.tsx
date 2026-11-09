import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { SpinSuccess } from "../types";
import { PrizeReveal, prizeTerms } from "./prize-reveal";

const base: SpinSuccess = {
  ok: true,
  slot: 7,
  label: "10,000₮ хөнгөлөлт",
  shortLabel: "10,000₮",
  kind: "coupon_fixed",
  tier: "rare",
  value: 10000,
  minSubtotal: 100000,
  maxDiscount: null,
  couponCode: "VNS-7KQ2",
  couponExpiresAt: null,
  pointsSpent: 0,
  points: 4200,
  orderSpins: 0,
  nextFreeAt: null,
  freeReady: false,
};

describe("PrizeReveal", () => {
  it("купоныг тасалбараар, ашиглах замтай харуулна", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<PrizeReveal result={base} open onClose={vi.fn()} />);

    expect(screen.getByRole("dialog")).toHaveTextContent("Ховор шагнал!");
    await userEvent.click(
      screen.getByRole("button", { name: "Купоны код VNS-7KQ2 хуулах" }),
    );
    expect(writeText).toHaveBeenCalledWith("VNS-7KQ2");
    expect(
      screen.getByRole("link", { name: "Купоноо ашиглах" }),
    ).toHaveAttribute("href", "/catalog");
  });

  it("дахин эргүүлэх эрх байвал шууд санал болгоно", async () => {
    const again = vi.fn();
    render(
      <PrizeReveal
        result={base}
        open
        onClose={vi.fn()}
        again={{ label: "Үнэгүй эргүүлэх", onClick: again }}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /Үнэгүй эргүүлэх/ }),
    );
    expect(again).toHaveBeenCalledOnce();
  });

  it("хожоогүй үед дэлгүүр рүү түлхэхгүй, хаах замтай", async () => {
    const onClose = vi.fn();
    render(
      <PrizeReveal
        result={{
          ...base,
          kind: "none",
          tier: "common",
          label: "Хоосон",
          couponCode: null,
          pointsSpent: 1000,
        }}
        tip={{ title: "Түвшин гэж юу вэ?", body: "Түвшин ахих тусам…" }}
        open
        onClose={onClose}
      />,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Энэ удаад шагнал таарсангүй");
    expect(dialog).toHaveTextContent("Түвшин гэж юу вэ?");
    // Клиент (2026-10-31): «Баярлалаа», зарцуулсан оноо харагдахгүй.
    expect(dialog).not.toHaveTextContent(/баярлалаа/i);
    expect(dialog).not.toHaveTextContent("зарцуулав");
    expect(screen.queryByRole("link")).toBeNull();
    await userEvent.click(screen.getAllByRole("button", { name: "Хаах" })[0]);
    expect(onClose).toHaveBeenCalled();
  });

  it("бодит бараа хожвол дараагийн захиалгад орно гэж хэлнэ", () => {
    expect(
      prizeTerms({
        ...base,
        kind: "product",
        label: "Eau Fraiche 5мл",
        couponCode: null,
      }),
    ).toEqual([
      "Шагнал «Миний шагнал» хэсэгт хадгалагдлаа — дараагийн захиалгад тань үнэгүй орно.",
    ]);
  });
});

describe("prizeTerms", () => {
  it("купоны нөхцөл: доод дүн, дээд хөнгөлөлт", () => {
    expect(prizeTerms({ ...base, maxDiscount: 20000 })).toEqual([
      "100,000₮-с дээш захиалгад",
      "Дээд хөнгөлөлт 20,000₮",
    ]);
  });
});

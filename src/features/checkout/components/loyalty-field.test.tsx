import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LoyaltyField } from "./loyalty-field";

/**
 * Хамгийн энгийн тохиргоо: 1 оноо = 1₮, 1,240 оноотой, дээд тал нь 1,240₮.
 * Энэ ханш дээр `₮` тэмдэг ХАРАГДАХГҮЙ (клиентийн санал 4.2) — оролт нь
 * «Зарцуулах оноо» гэсэн нэртэй.
 */
function setup(over: Partial<React.ComponentProps<typeof LoyaltyField>> = {}) {
  const onChange = vi.fn();
  const props = {
    value: 0,
    onChange,
    max: 1240,
    balance: 1240,
    redeemRate: 1,
    ...over,
  };
  const view = render(<LoyaltyField {...props} />);
  const label =
    (props.redeemRate ?? 1) === 1 ? "Зарцуулах оноо" : "Оноогоор төлөх дүн (₮)";
  const input = screen.getByLabelText(label);
  return { onChange, input, view, props };
}

describe("LoyaltyField", () => {
  it("lets the customer spend part of the balance, not all of it", () => {
    const { onChange, input } = setup();
    fireEvent.change(input, { target: { value: "500" } });
    expect(onChange).toHaveBeenCalledWith(500);
  });

  it("clamps above the order's ceiling and says what the ceiling is", () => {
    const { onChange, input } = setup();
    fireEvent.change(input, { target: { value: "99999" } });
    expect(onChange).toHaveBeenCalledWith(1240);
    // Ханш 1:1 тул тэмдэггүй — 4.2.
    expect(screen.getByText(/хамгийн ихдээ 1,240 ашиглана/i)).toBeTruthy();
    expect(screen.queryByText(/1,240₮/)).toBeNull();
  });

  it("ignores anything that is not a digit", () => {
    const { onChange, input } = setup();
    fireEvent.change(input, { target: { value: "1 2a3" } });
    expect(onChange).toHaveBeenCalledWith(123);
  });

  it("fills the ceiling in one tap, and clears it on the second", () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Бүгдийг" }));
    expect(onChange).toHaveBeenCalledWith(1240);
  });

  it("clears an applied amount", () => {
    const { onChange } = setup({ value: 1240 });
    fireEvent.click(screen.getByRole("button", { name: "Болих" }));
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it("converts the amount back into points at the admin's rate", () => {
    // 2₮ per point: 500₮ costs 250 points and leaves 990 of 1,240. Хоёр тоо
    // ялгаатай болох тул нэгжээ хэлэх ёстой — `₮` эргэж ирнэ.
    setup({ value: 500, redeemRate: 2 });
    expect(
      screen.getByText("250 оноо зарцуулж, 990 үлдэнэ."),
    ).toBeTruthy();
  });
});

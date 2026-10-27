import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BirthdayPicker } from "./birthday-picker";

const MAX = "2026-10-26";

describe("BirthdayPicker", () => {
  it("хоосон үед он → сар → өдөр гэж алхуулна", async () => {
    const onChange = vi.fn();
    render(<BirthdayPicker value="" max={MAX} onChange={onChange} />);

    // Он сонгох алхам — 2000 он идэвхтэй харагдана.
    await userEvent.click(screen.getByRole("button", { name: "1995" }));
    await userEvent.click(screen.getByRole("button", { name: "3-р сар" }));
    await userEvent.click(screen.getByRole("button", { name: "1995-03-14" }));

    expect(onChange).toHaveBeenCalledWith("1995-03-14");
  });

  it("утгатай бол шууд тэр сарын өдрүүдээр нээгдэнэ", () => {
    render(<BirthdayPicker value="1990-07-09" max={MAX} onChange={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: "1990-07-09", pressed: true }),
    ).toBeTruthy();
  });

  it("ирээдүйн өдөр, сарыг сонгуулахгүй", async () => {
    render(<BirthdayPicker value="2026-10-01" max={MAX} onChange={vi.fn()} />);
    expect(
      (screen.getByRole("button", { name: "2026-10-27" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Дараах сар" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    await userEvent.click(screen.getByRole("button", { name: /10-р сар/ }));
    expect(
      (screen.getByRole("button", { name: "11-р сар" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("гарчгийн онноос он сонгох руу буцна", async () => {
    render(<BirthdayPicker value="1990-07-09" max={MAX} onChange={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "1990" }));
    expect(screen.getByRole("button", { name: "1900" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "2027" })).toBeNull();
  });
});

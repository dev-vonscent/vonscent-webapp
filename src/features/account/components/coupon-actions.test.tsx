import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CopyCodeButton } from "./coupon-actions";

describe("CopyCodeButton", () => {
  it("is an icon that copies the code and turns into a check", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    render(<CopyCodeButton code="VW-GUACHX" />);

    const button = screen.getByRole("button", {
      name: "VW-GUACHX кодыг хуулах",
    });
    expect(button.textContent).toBe("");

    await userEvent.click(button);
    expect(writeText).toHaveBeenCalledWith("VW-GUACHX");
    expect(screen.getByRole("button", { name: "Хуулсан" })).toBeTruthy();
  });
});

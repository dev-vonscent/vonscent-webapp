import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GuestPerksPrompt } from "./guest-perks-prompt";

describe("GuestPerksPrompt", () => {
  it("sends the guest to sign in and back to checkout, saving the draft", async () => {
    const onNavigate = vi.fn();
    render(
      <GuestPerksPrompt
        href="/login?next=%2Fcheckout"
        onNavigate={onNavigate}
      />,
    );

    expect(screen.getByText(/Купон, V point ашиглах бол/)).toBeTruthy();
    const link = screen.getByRole("link", { name: "нэвтэрнэ үү" });
    expect(link.getAttribute("href")).toBe("/login?next=%2Fcheckout");

    link.addEventListener("click", (e) => e.preventDefault());
    await userEvent.click(link);
    expect(onNavigate).toHaveBeenCalled();
  });
});

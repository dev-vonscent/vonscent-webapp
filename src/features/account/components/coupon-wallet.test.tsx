import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CouponWallet } from "./coupon-wallet";
import type { WalletCoupon } from "./coupons";

const data = vi.fn<() => WalletCoupon[]>();
vi.mock("../use-coupons", () => ({
  useWallet: () => ({
    data: data(),
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));
const markSeen = vi.fn();
vi.mock("../use-new-badge", () => ({ markSeen: (k: string) => markSeen(k) }));

const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

function coupon(over: Partial<WalletCoupon>): WalletCoupon {
  return {
    id: over.code ?? "id",
    code: "VS-AAAAAA",
    type: "percent",
    value: 10,
    minSubtotal: 0,
    maxDiscount: null,
    endsAt: day(30),
    maxUses: 1,
    usedCount: 0,
    source: "manual",
    status: "active",
    redemptions: [],
    ...over,
  };
}

beforeEach(() => {
  markSeen.mockClear();
  data.mockReturnValue([
    coupon({ code: "LATE", endsAt: day(40) }),
    coupon({ code: "SOON", endsAt: day(2) }),
    coupon({
      code: "GIVEN",
      status: "used",
      usedCount: 1,
      redemptions: [
        { by: { name: "Б***", phone: "••2233" }, at: "2026-09-28T04:00:00Z" },
      ],
    }),
    coupon({ code: "OLD", status: "expired", endsAt: day(-3) }),
  ]);
});

describe("CouponWallet", () => {
  it("lists identical coupons separately, soonest expiry first", () => {
    render(<CouponWallet />);
    const codes = screen
      .getAllByRole("article")
      .map((a) => within(a).getByText(/^[A-Z]+$/).textContent);
    expect(codes).toEqual(["SOON", "LATE"]);
    expect(screen.getByText("2 хоног үлдсэн")).toBeTruthy();
  });

  it("gives each active coupon a copy button, and no share", () => {
    render(<CouponWallet />);
    expect(
      screen.getAllByRole("button", { name: /кодыг хуулах/ }),
    ).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /хуваалцах/ })).toBeNull();
  });

  it("puts a minimum order on its own line", () => {
    data.mockReturnValue([coupon({ code: "MIN", minSubtotal: 100000 })]);
    render(<CouponWallet />);
    expect(screen.getByText("100,000₮-өөс дээш захиалгад")).toBeTruthy();
  });

  it("shows a shared coupon under «Ашиглагдсан» with the masked friend", async () => {
    render(<CouponWallet />);
    await userEvent.click(screen.getByRole("tab", { name: /Ашиглагдсан/ }));
    expect(screen.getByText("GIVEN")).toBeTruthy();
    expect(screen.getByText("Б*** (••2233)")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /хуулах/ })).toBeNull();
  });

  it("keeps expired coupons in their own tab", async () => {
    render(<CouponWallet />);
    await userEvent.click(screen.getByRole("tab", { name: /Хугацаа дууссан/ }));
    expect(screen.getByText("OLD")).toBeTruthy();
    expect(screen.queryByText("SOON")).toBeNull();
  });

  it("retires the «Шинэ» menu badge once visited", () => {
    render(<CouponWallet />);
    expect(markSeen).toHaveBeenCalledWith("coupons");
  });
});

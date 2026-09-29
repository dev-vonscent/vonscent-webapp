import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CouponDetail } from "./coupon-detail";
import type { WalletCoupon } from "./coupons";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const wallet = vi.fn<() => { data: WalletCoupon | null; isPending: boolean }>();
vi.mock("../use-coupons", () => ({ useWalletCoupon: () => wallet() }));

const setCoupon = vi.fn();
const clearBuyNow = vi.fn();
let subtotal = 150000;
vi.mock("@/features/cart/store", () => ({
  selectSubtotal: (s: unknown) => s,
  // The component reads the subtotal through a selector and the setter
  // directly; both are faked so the test can drive an empty or full cart.
  useCart: (selector: (s: unknown) => unknown) =>
    selector === undefined ? undefined : pick(selector),
}));
function pick(selector: (s: unknown) => unknown) {
  const state = { setCoupon, clearBuyNow };
  const viaSelector = selector(subtotal);
  return typeof viaSelector === "number" ? viaSelector : selector(state);
}

function coupon(over: Partial<WalletCoupon> = {}): WalletCoupon {
  return {
    id: "c1",
    code: "VW-3QAQYS",
    type: "percent",
    value: 10,
    minSubtotal: 100000,
    maxDiscount: null,
    endsAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
    maxUses: 1,
    usedCount: 0,
    source: "spin",
    status: "active",
    redemptions: [],
    ...over,
  };
}

beforeEach(() => {
  subtotal = 150000;
  wallet.mockReturnValue({ data: coupon(), isPending: false });
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("coupon detail", () => {
  it("shows the code and every condition attached to it", () => {
    render(<CouponDetail code="VW-3QAQYS" />);

    expect(screen.getByText("VW-3QAQYS")).toBeTruthy();
    expect(screen.getByText("10%")).toBeTruthy();
    expect(screen.getByText("Купоны код")).toBeTruthy();
    expect(screen.getByText("Хүчинтэй хугацаа")).toBeTruthy();
    expect(screen.getByText(/100,000₮-өөс дээш захиалга/)).toBeTruthy();
    expect(screen.getByText("1 удаа үлдсэн")).toBeTruthy();
    // A wheel coupon says where it came from.
    expect(screen.getByText(/Азын хүрднээс/)).toBeTruthy();
    expect(screen.getByText("Идэвхтэй")).toBeTruthy();
  });

  it("offers copy and share on an active coupon", () => {
    render(<CouponDetail code="VW-3QAQYS" />);
    expect(screen.getByRole("button", { name: /кодыг хуулах/ })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /кодыг хуваалцах/ }),
    ).toBeTruthy();
  });

  it("flags an expiry that is nearly up", () => {
    render(<CouponDetail code="VW-3QAQYS" />);
    expect(screen.getByText(/2 хоног үлдсэн/)).toBeTruthy();
  });

  it("says the coupon is not theirs rather than rendering a blank ticket", () => {
    wallet.mockReturnValue({ data: null, isPending: false });
    render(<CouponDetail code="NOPE" />);
    expect(screen.getByText("Купон олдсонгүй")).toBeTruthy();
  });

  it("shows who used a shared coupon — masked — and no way to apply it", () => {
    wallet.mockReturnValue({
      data: coupon({
        status: "used",
        usedCount: 1,
        redemptions: [
          { by: { name: "Б***", phone: "••2233" }, at: "2026-09-28T04:00:00Z" },
        ],
      }),
      isPending: false,
    });
    render(<CouponDetail code="VW-3QAQYS" />);

    expect(screen.getByText("Ашиглагдсан")).toBeTruthy();
    expect(screen.getByText("Б*** (••2233)")).toBeTruthy();
    expect(screen.getByText("2026.09.28")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ашиглах" })).toBeNull();
    expect(screen.queryByRole("button", { name: /хуваалцах/ })).toBeNull();
  });

  it("validates against the cart before applying, then goes to checkout", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: async () => ({ valid: true, code: "VW-3QAQYS", discount: 15000 }),
    });
    render(<CouponDetail code="VW-3QAQYS" />);

    await userEvent.click(screen.getByRole("button", { name: "Ашиглах" }));

    expect(fetch).toHaveBeenCalledWith(
      "/api/coupons/validate",
      expect.objectContaining({ method: "POST" }),
    );
    expect(setCoupon).toHaveBeenCalledWith({
      code: "VW-3QAQYS",
      discount: 15000,
    });
    expect(push).toHaveBeenCalledWith("/checkout");
  });

  it("surfaces a rejection instead of applying it", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: async () => ({ valid: false, message: "Дүн хүрэхгүй байна." }),
    });
    render(<CouponDetail code="VW-3QAQYS" />);

    await userEvent.click(screen.getByRole("button", { name: "Ашиглах" }));
    expect(await screen.findByText("Дүн хүрэхгүй байна.")).toBeTruthy();
    expect(setCoupon).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("sends an empty cart shopping instead of failing validation", async () => {
    subtotal = 0;
    render(<CouponDetail code="VW-3QAQYS" />);

    await userEvent.click(screen.getByRole("button", { name: "Дэлгүүр үзэх" }));
    expect(fetch).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/catalog");
  });
});

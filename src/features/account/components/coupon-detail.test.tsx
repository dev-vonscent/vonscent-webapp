import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CouponDetail } from "./coupon-detail";
import type { CouponRecord } from "./coupons";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const rows = vi.fn<() => (CouponRecord & { source: string })[]>();
vi.mock("@/lib/supabase/browser", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => Promise.resolve({ data: rows() }),
      }),
    }),
  }),
}));

const setCoupon = vi.fn();
let subtotal = 150000;
vi.mock("@/features/cart/store", () => ({
  selectSubtotal: (s: unknown) => s,
  // The component reads the subtotal through a selector and the setter
  // directly; both are faked so the test can drive an empty or full cart.
  useCart: (selector: (s: unknown) => unknown) =>
    selector === undefined ? undefined : pick(selector),
}));
function pick(selector: (s: unknown) => unknown) {
  const state = { setCoupon };
  const viaSelector = selector(subtotal);
  return typeof viaSelector === "number" ? viaSelector : selector(state);
}

function coupon(over: Partial<CouponRecord & { source: string }> = {}) {
  return {
    id: "c1",
    code: "VW-3QAQYS",
    type: "percent" as const,
    value: 10,
    min_subtotal: 100000,
    ends_at: new Date(Date.now() + 2 * 86_400_000).toISOString(),
    max_uses: 1,
    used_count: 0,
    user_id: "u1",
    source: "spin",
    ...over,
  };
}

beforeEach(() => {
  subtotal = 150000;
  rows.mockReturnValue([coupon()]);
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("coupon detail", () => {
  it("shows the code and every condition attached to it", async () => {
    render(<CouponDetail code="VW-3QAQYS" />);

    expect(await screen.findByText("VW-3QAQYS")).toBeTruthy();
    expect(screen.getByText("10%")).toBeTruthy();
    expect(screen.getByText("Купоны код")).toBeTruthy();
    expect(screen.getByText("Хүчинтэй хугацаа")).toBeTruthy();
    expect(screen.getByText(/100,000₮-өөс дээш захиалга/)).toBeTruthy();
    expect(screen.getByText("1 удаа үлдсэн")).toBeTruthy();
    // A wheel coupon says where it came from.
    expect(screen.getByText(/Азын хүрднээс/)).toBeTruthy();
    expect(screen.getByText("Зөвхөн танд")).toBeTruthy();
  });

  it("flags an expiry that is nearly up", async () => {
    render(<CouponDetail code="VW-3QAQYS" />);
    expect(await screen.findByText(/2 хоног үлдсэн/)).toBeTruthy();
  });

  it("says the coupon is gone rather than rendering a blank ticket", async () => {
    rows.mockReturnValue([]);
    render(<CouponDetail code="NOPE" />);
    expect(await screen.findByText("Купон олдсонгүй")).toBeTruthy();
  });

  it("hides a coupon that has already been spent", async () => {
    // usable() drops it, so the URL of a redeemed code is a dead end.
    rows.mockReturnValue([coupon({ used_count: 1, max_uses: 1 })]);
    render(<CouponDetail code="VW-3QAQYS" />);
    expect(await screen.findByText("Купон олдсонгүй")).toBeTruthy();
  });

  it("validates against the cart before applying, then goes to checkout", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: async () => ({ valid: true, code: "VW-3QAQYS", discount: 15000 }),
    });
    render(<CouponDetail code="VW-3QAQYS" />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Ашиглах" }),
    );

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

    await userEvent.click(
      await screen.findByRole("button", { name: "Ашиглах" }),
    );
    expect(await screen.findByText("Дүн хүрэхгүй байна.")).toBeTruthy();
    expect(setCoupon).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("sends an empty cart shopping instead of failing validation", async () => {
    subtotal = 0;
    render(<CouponDetail code="VW-3QAQYS" />);

    const button = await screen.findByRole("button", { name: "Дэлгүүр үзэх" });
    await userEvent.click(button);
    expect(fetch).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/catalog");
  });
});

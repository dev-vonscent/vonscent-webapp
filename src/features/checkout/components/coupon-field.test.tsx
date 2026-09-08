import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CouponField } from "./coupon-field";
import type { AvailableCoupon } from "@/app/api/coupons/available/route";

function offer(over: Partial<AvailableCoupon> = {}): AvailableCoupon {
  return {
    code: "VW7K2X",
    type: "percent",
    value: 10,
    discount: 8000,
    minSubtotal: 0,
    endsAt: null,
    personal: false,
    ...over,
  };
}

const NOOP = {
  code: "",
  onCodeChange: () => {},
  onApply: () => {},
  applying: false,
  message: null,
  onPick: () => {},
  onRemove: () => {},
};

describe("applied coupon", () => {
  it("shows the code and what it saved", () => {
    render(
      <CouponField
        {...NOOP}
        applied={{ code: "VWQ13B", discount: 10000 }}
        offers={[]}
      />,
    );

    expect(screen.getByText("VWQ13B")).toBeTruthy();
    expect(screen.getByText("10,000₮ хэмнэлээ")).toBeTruthy();
    // Nothing left to choose while one is applied.
    expect(screen.queryByPlaceholderText("Купон код")).toBeNull();
  });

  it("can be removed", async () => {
    const onRemove = vi.fn();
    render(
      <CouponField
        {...NOOP}
        applied={{ code: "VWQ13B", discount: 10000 }}
        offers={[]}
        onRemove={onRemove}
      />,
    );

    await userEvent.click(screen.getByLabelText("Купон хасах"));
    expect(onRemove).toHaveBeenCalled();
  });
});

describe("available coupons", () => {
  const OFFERS = [
    offer({ code: "VW7K2X", type: "percent", value: 10, discount: 8000 }),
    offer({ code: "VWQ13B", type: "fixed", value: 5000, discount: 5000 }),
  ];

  it("leads with what each coupon is, not just its code", () => {
    render(<CouponField {...NOOP} applied={null} offers={OFFERS} />);

    expect(screen.getByText("10%")).toBeTruthy();
    // A fixed amount is compacted so it fits the tile.
    expect(screen.getByText("5мянга")).toBeTruthy();
    expect(screen.getByText("−8,000₮")).toBeTruthy();
  });

  it("marks the best saving, and only when there is a choice", () => {
    const { unmount } = render(
      <CouponField {...NOOP} applied={null} offers={OFFERS} />,
    );
    expect(screen.getAllByText("Хамгийн их")).toHaveLength(1);
    unmount();

    render(<CouponField {...NOOP} applied={null} offers={[OFFERS[0]]} />);
    expect(screen.queryByText("Хамгийн их")).toBeNull();
  });

  it("applies one on a tap", async () => {
    const onPick = vi.fn();
    render(
      <CouponField {...NOOP} applied={null} offers={OFFERS} onPick={onPick} />,
    );

    await userEvent.click(screen.getByText("VWQ13B"));
    expect(onPick).toHaveBeenCalledWith(OFFERS[1]);
  });

  it("folds the manual input away when there are offers to pick", async () => {
    render(<CouponField {...NOOP} applied={null} offers={OFFERS} />);

    expect(screen.queryByPlaceholderText("Купон код")).toBeNull();
    await userEvent.click(screen.getByText("Өөр код оруулах"));
    expect(screen.getByPlaceholderText("Купон код")).toBeTruthy();
  });

  it("shows the input straight away when there are none", () => {
    render(<CouponField {...NOOP} applied={null} offers={[]} />);
    expect(screen.getByPlaceholderText("Купон код")).toBeTruthy();
  });

  it("flags an expiry only when it is close enough to act on", () => {
    const days = (n: number) =>
      new Date(Date.now() + n * 86_400_000).toISOString();
    render(
      <CouponField
        {...NOOP}
        applied={null}
        offers={[
          offer({ code: "SOON", endsAt: days(2) }),
          offer({ code: "LATER", endsAt: days(25) }),
        ]}
      />,
    );

    // A month-long wheel coupon on every row would be noise.
    expect(screen.getByText("2 хоногийн дараа дуусна")).toBeTruthy();
    expect(screen.queryByText(/25 хоног/)).toBeNull();
  });
});

describe("manual entry", () => {
  it("stays disabled until something is typed", () => {
    render(<CouponField {...NOOP} applied={null} offers={[]} />);
    expect(
      screen.getByRole("button", { name: "Хэрэглэх" }).hasAttribute("disabled"),
    ).toBe(true);
  });

  it("applies on Enter as well as on the button", async () => {
    const onApply = vi.fn();
    render(
      <CouponField
        {...NOOP}
        applied={null}
        offers={[]}
        code="VW7K2X"
        onApply={onApply}
      />,
    );

    await userEvent.type(screen.getByPlaceholderText("Купон код"), "{Enter}");
    expect(onApply).toHaveBeenCalled();
  });

  it("surfaces a rejection message", () => {
    render(
      <CouponField
        {...NOOP}
        applied={null}
        offers={[]}
        message="Купон хүчингүй байна."
      />,
    );
    expect(screen.getByText("Купон хүчингүй байна.")).toBeTruthy();
  });
});

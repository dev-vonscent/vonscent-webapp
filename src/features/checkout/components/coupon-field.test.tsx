import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CouponField } from "./coupon-field";
import type { AvailableCoupon } from "@/app/api/coupons/available/route";

function offer(over: Partial<AvailableCoupon> = {}): AvailableCoupon {
  return {
    id: over.code ?? "VW7K2X",
    code: "VW7K2X",
    type: "percent",
    value: 10,
    discount: 8000,
    minSubtotal: 0,
    maxDiscount: null,
    eligible: true,
    shortfall: 0,
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

/** «Солих» / «Сонгох» — бүх санал dialog дотор. */
async function openPicker(name: RegExp = /Солих|Сонгох/) {
  await userEvent.click(screen.getByRole("button", { name }));
  return screen.findByRole("dialog");
}

describe("applied coupon", () => {
  it("fits on one line: code · saving", () => {
    render(
      <CouponField
        {...NOOP}
        applied={{ code: "VWQ13B", discount: 10000 }}
        offers={[]}
      />,
    );

    expect(screen.getByText("VWQ13B")).toBeTruthy();
    expect(screen.getByText("−10,000₮")).toBeTruthy();
    // Nothing to type while one is applied — the input lives in the dialog.
    expect(screen.queryByPlaceholderText("Купон код")).toBeNull();
  });

  it("says when the page picked it", () => {
    render(
      <CouponField
        {...NOOP}
        applied={{ code: "VWQ13B", discount: 10000 }}
        autoApplied
        offers={[]}
      />,
    );
    expect(screen.getByText("Хамгийн их хэмнэлттэйг сонголоо")).toBeTruthy();
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

  it("counts the coupons to swap between, and marks the one in use", async () => {
    const offers = [
      offer({ code: "VWQ13B", discount: 10000 }),
      offer({ code: "VW7K2X", discount: 8000 }),
    ];
    render(
      <CouponField
        {...NOOP}
        applied={{ code: "VWQ13B", discount: 10000 }}
        offers={offers}
      />,
    );

    const dialog = await openPicker(/Солих \(2\)/);
    const inUse = within(dialog).getByText("Хэрэглэж байна");
    expect(inUse.closest("button")?.getAttribute("aria-pressed")).toBe("true");
  });
});

describe("available coupons", () => {
  const OFFERS = [
    offer({ code: "VW7K2X", type: "percent", value: 10, discount: 8000 }),
    offer({ code: "VWQ13B", type: "fixed", value: 5000, discount: 5000 }),
  ];

  it("sums them up in one row instead of listing every card", () => {
    render(<CouponField {...NOOP} applied={null} offers={OFFERS} />);

    expect(screen.getByText("2 купон ашиглах боломжтой")).toBeTruthy();
    expect(screen.getByText("−8,000₮")).toBeTruthy();
    // The codes themselves wait in the dialog.
    expect(screen.queryByText("VWQ13B")).toBeNull();
  });

  it("leads with what each coupon is, not just its code", async () => {
    render(<CouponField {...NOOP} applied={null} offers={OFFERS} />);
    const dialog = await openPicker();

    expect(within(dialog).getByText("10%")).toBeTruthy();
    // A fixed amount is compacted so it fits the tile.
    expect(within(dialog).getByText("5k")).toBeTruthy();
    expect(within(dialog).getByText("−8,000₮")).toBeTruthy();
  });

  it("marks the best saving, and only when there is a choice", async () => {
    const { unmount } = render(
      <CouponField {...NOOP} applied={null} offers={OFFERS} />,
    );
    expect(
      within(await openPicker()).getAllByText("Хамгийн их хэмнэлт"),
    ).toHaveLength(1);
    unmount();

    render(<CouponField {...NOOP} applied={null} offers={[OFFERS[0]]} />);
    expect(
      within(await openPicker()).queryByText("Хамгийн их хэмнэлт"),
    ).toBeNull();
  });

  it("applies one on a tap and closes", async () => {
    const onPick = vi.fn();
    render(
      <CouponField {...NOOP} applied={null} offers={OFFERS} onPick={onPick} />,
    );

    const dialog = await openPicker();
    await userEvent.click(within(dialog).getByText("VWQ13B"));
    expect(onPick).toHaveBeenCalledWith(OFFERS[1]);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("lists every coupon, however many, with the code field outside the scroll", async () => {
    const ten = Array.from({ length: 10 }, (_, i) =>
      offer({ code: `C${i}`, discount: 1000 + i }),
    );
    render(<CouponField {...NOOP} applied={null} offers={ten} />);
    expect(screen.getByText("10 купон ашиглах боломжтой")).toBeTruthy();

    const dialog = await openPicker();
    const list = within(dialog).getByRole("list", { name: "Таны купон" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(10);
    expect(list.className).toContain("overflow-y-auto");
    const input = within(dialog).getByPlaceholderText("Купон код");
    expect(list.contains(input)).toBe(false);
  });

  it("keeps a code field in the dialog", async () => {
    render(<CouponField {...NOOP} applied={null} offers={OFFERS} />);

    expect(screen.queryByPlaceholderText("Купон код")).toBeNull();
    const dialog = await openPicker();
    expect(within(dialog).getByPlaceholderText("Купон код")).toBeTruthy();
  });

  it("shows the input straight away when there are none", () => {
    render(<CouponField {...NOOP} applied={null} offers={[]} />);
    expect(screen.getByPlaceholderText("Купон код")).toBeTruthy();
  });

  it("flags an expiry only when it is close enough to act on", async () => {
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
    const dialog = await openPicker();

    // Close: a countdown. Far: the plain date, never "25 хоногийн дараа".
    expect(within(dialog).getByText("2 хоногийн дараа дуусна")).toBeTruthy();
    expect(within(dialog).queryByText(/25 хоног/)).toBeNull();
    expect(within(dialog).getByText(/хүртэл$/)).toBeTruthy();
  });

  it("lists every coupon separately, even identical offers", async () => {
    render(
      <CouponField
        {...NOOP}
        applied={null}
        offers={[
          offer({ code: "A1", endsAt: "2026-12-01T00:00:00Z" }),
          offer({ code: "A2", endsAt: "2026-12-20T00:00:00Z" }),
        ]}
      />,
    );
    const dialog = await openPicker();
    expect(within(dialog).getByText("A1")).toBeTruthy();
    expect(within(dialog).getByText("A2")).toBeTruthy();
    // Equal savings: no "best" to single out.
    expect(within(dialog).queryByText("Хамгийн их хэмнэлт")).toBeNull();
  });

  it("marks the biggest saving even when it is not first", async () => {
    render(
      <CouponField
        {...NOOP}
        applied={null}
        offers={[
          offer({ code: "SOON", discount: 3000 }),
          offer({ code: "BIG", discount: 9000 }),
        ]}
      />,
    );
    const badge = within(await openPicker()).getByText("Хамгийн их хэмнэлт");
    expect(badge.closest("button")?.textContent).toContain("BIG");
  });

  it("shows the coupon's conditions", async () => {
    render(
      <CouponField
        {...NOOP}
        applied={null}
        offers={[offer({ minSubtotal: 100000, maxDiscount: 20000 })]}
      />,
    );
    expect(
      within(await openPicker()).getByText(
        /100,000₮-өөс дээш захиалгад · дээд тал нь 20,000₮/,
      ),
    ).toBeTruthy();
  });

  it("shows a coupon below its minimum with what is left to add, unpickable", async () => {
    const onPick = vi.fn();
    render(
      <CouponField
        {...NOOP}
        applied={null}
        onPick={onPick}
        offers={[
          offer({
            code: "MIN100",
            minSubtotal: 100000,
            eligible: false,
            shortfall: 40000,
            discount: 0,
          }),
        ]}
      />,
    );
    // Nothing pickable, so the manual input is open on the page …
    expect(screen.getByPlaceholderText("Купон код")).toBeTruthy();
    // … and the locked coupon is one tap away.
    const dialog = await openPicker(/Бусад купон \(1\)/);
    expect(
      within(dialog).getByText("Дахин 40,000₮-ийн бараа нэмбэл ашиглана"),
    ).toBeTruthy();
    const row = within(dialog).getByText("MIN100").closest("button")!;
    expect(row.hasAttribute("disabled")).toBe(true);
    await userEvent.click(row);
    expect(onPick).not.toHaveBeenCalled();
  });
});

describe("links under the field", () => {
  it("offers the locked coupons when none can be used yet", async () => {
    render(
      <CouponField
        {...NOOP}
        applied={null}
        offers={[offer({ eligible: false, discount: 0, shortfall: 1000 })]}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Бусад купон (1)" }),
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("no longer links out to the wallet", () => {
    render(<CouponField {...NOOP} applied={null} offers={[]} />);
    expect(
      screen.queryByRole("link", { name: /Миний купоныг харах/ }),
    ).toBeNull();
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

  it("calls apply without the click event as the code", async () => {
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

    await userEvent.click(screen.getByRole("button", { name: "Хэрэглэх" }));
    expect(onApply).toHaveBeenCalledWith();
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

  it("closes the dialog once a typed code goes through", async () => {
    const { rerender } = render(
      <CouponField {...NOOP} applied={null} offers={[offer()]} />,
    );
    await openPicker();
    rerender(
      <CouponField
        {...NOOP}
        applied={{ code: "TYPED1", discount: 2000 }}
        offers={[offer()]}
      />,
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

describe("while the offers are still loading", () => {
  it("keeps the manual input out of the way instead of flashing it", () => {
    // Купоныг × дарж хассан яг тэр мөч: жагсаалт хоосон ч «купон байхгүй»
    // гэсэн үг биш. Input гарч ирээд санал ирэхэд алга болвол анивчина.
    render(<CouponField {...NOOP} applied={null} offers={[]} loading />);

    expect(screen.queryByPlaceholderText("Купон код")).toBeNull();
  });

  it("still offers the input once the answer is in and there is nothing", () => {
    render(
      <CouponField {...NOOP} applied={null} offers={[]} loading={false} />,
    );

    expect(screen.getByPlaceholderText("Купон код")).toBeTruthy();
  });
});

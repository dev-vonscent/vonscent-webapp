import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OrderActions } from "./order-actions";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh }),
}));
// Declined, so only the confirmation's content is exercised — no request.
const confirm = vi.fn().mockResolvedValue(false);
vi.mock("@/components/shared/confirm-dialog", () => ({
  useConfirm: () => [confirm, null],
}));

function stubFetch(body: unknown = { ok: true }, status = 200) {
  const fn = vi.fn(async () => Response.json(body, { status }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

beforeEach(() => {
  confirm.mockClear();
  refresh.mockClear();
});
afterEach(() => vi.unstubAllGlobals());

/**
 * Зөвхөн төлөөгүй захиалга цуцлагдана — төлсөнд `cancellable` нь false
 * (клиент, 2026-10-26), тиймээс шимтгэл, буцаалтын данс байхгүй.
 */
describe("OrderActions — unpaid order", () => {
  it("confirms plainly and cancels without an account", async () => {
    const fetch = stubFetch();
    render(<OrderActions orderId="o1" items={[]} cancellable />);
    await userEvent.click(screen.getByRole("button", { name: /Цуцлах/ }));
    const { description, action } = confirm.mock.calls[0][0] as {
      description: string;
      action: () => Promise<void>;
    };
    expect(description).not.toMatch(/шимтгэл/);

    // `act` дотор хүлээвэл transition flush хийгдэхгүй — waitFor-оор.
    let done = false;
    void action().then(() => {
      done = true;
    });
    await waitFor(() => expect(done).toBe(true));
    expect(fetch).toHaveBeenCalledWith("/api/orders/o1/cancel", {
      method: "POST",
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("offers no cancel button once the order can't be cancelled", () => {
    render(<OrderActions orderId="o1" items={[]} cancellable={false} />);
    expect(screen.queryByRole("button", { name: /Цуцлах/ })).toBeNull();
  });
});

/**
 * Төлбөр хүлээж буй захиалга (клиент, 2026-10): «Цуцлах», «Дахин захиалах»
 * биш — «Дараа захиалах» ба «Устгах» (0124).
 */
describe("OrderActions — awaiting payment", () => {
  it("offers save-for-later and delete instead of cancel and reorder", () => {
    render(<OrderActions orderId="o1" items={[]} cancellable payToken="tok" />);
    expect(screen.getByRole("button", { name: /Дараа захиалах/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Устгах/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Цуцлах/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Дахин захиалах/ })).toBeNull();
  });

  it("drops save-for-later when the order carries no cart copy", () => {
    render(
      <OrderActions
        orderId="o1"
        items={[]}
        cancellable
        payToken="tok"
        canSaveForLater={false}
      />,
    );
    expect(screen.queryByRole("button", { name: /Дараа захиалах/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Устгах/ })).toBeTruthy();
  });

  it("deletes through the payment abandon endpoint once confirmed", async () => {
    const fetch = stubFetch();
    render(<OrderActions orderId="o1" items={[]} cancellable payToken="tok" />);
    await userEvent.click(screen.getByRole("button", { name: /Устгах/ }));
    const { action } = confirm.mock.calls[0][0] as {
      action: () => Promise<void>;
    };
    await action();
    expect(fetch).toHaveBeenCalledWith(
      "/api/payments/abandon",
      expect.objectContaining({
        body: JSON.stringify({ token: "tok", saveForLater: false }),
      }),
    );
  });

  it("shows reorder only when there are lines to reorder", () => {
    render(
      <OrderActions
        orderId="o1"
        items={[
          {
            productId: "p1",
            slug: "p1",
            name: "P",
            brand: "B",
            variantId: "v1",
            ml: 5,
            unitPrice: 10_000,
            image: null,
            qty: 1,
          },
        ]}
        cancellable={false}
      />,
    );
    expect(screen.getByRole("button", { name: /Дахин захиалах/ })).toBeTruthy();
  });
});

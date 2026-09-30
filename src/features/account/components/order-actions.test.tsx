import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
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

// Radix Select нь jsdom-д байхгүй pointer capture / scrollIntoView дууддаг.
beforeAll(() => {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
});

const FEE = /банкны 1%-ийн шимтгэлийг хасаж/;

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
 * Төлсөн захиалгыг цуцлахад банкны 1% шимтгэл хасагдаж, мөнгийг админ
 * хэрэглэгчийн бичсэн данс руу гараар буцаана (QPay зөвхөн картыг буцаадаг).
 * Клиент, 2026-09-30.
 */
describe("OrderActions — paid order", () => {
  it("warns about the fee before the button is even pressed", () => {
    render(
      <OrderActions orderId="o1" items={[]} cancellable paid total={100_000} />,
    );
    expect(screen.getByText(FEE)).toBeTruthy();
  });

  it("shows the refund amount and asks for the account before cancelling", async () => {
    const fetch = stubFetch();
    render(
      <OrderActions orderId="o1" items={[]} cancellable paid total={100_000} />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Цуцлах/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("99,000₮")).toBeTruthy();
    expect(within(dialog).getByText("−1,000₮")).toBeTruthy();

    // Хоосон илгээвэл сервер рүү явахгүй, талбар бүр алдаагаа хэлнэ.
    await userEvent.click(
      within(dialog).getByRole("button", { name: /Захиалга цуцлах/ }),
    );
    expect(fetch).not.toHaveBeenCalled();
    expect(
      within(dialog).getByText("Банкаа сонгоно уу", {
        selector: "[role=alert]",
      }),
    ).toBeTruthy();

    await userEvent.click(within(dialog).getByRole("combobox"));
    await userEvent.click(
      await screen.findByRole("option", { name: "Хаан банк" }),
    );
    await userEvent.type(
      within(dialog).getByLabelText("Дансны дугаар"),
      "5000 1234 5678",
    );
    await userEvent.type(
      within(dialog).getByLabelText("Данс эзэмшигчийн нэр"),
      "Сараа",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: /Захиалга цуцлах/ }),
    );

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(fetch).toHaveBeenCalledWith("/api/orders/o1/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        refundAccount: {
          bank: "Хаан банк",
          accountNumber: "5000 1234 5678",
          holderName: "Сараа",
        },
      }),
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("keeps the dialog open with the server's reason when cancelling fails", async () => {
    stubFetch({ error: "PAST_CUTOFF" }, 409);
    render(
      <OrderActions orderId="o1" items={[]} cancellable paid total={100_000} />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Цуцлах/ }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("combobox"));
    await userEvent.click(
      await screen.findByRole("option", { name: "Голомт банк" }),
    );
    await userEvent.type(
      within(dialog).getByLabelText("Дансны дугаар"),
      "123456789",
    );
    await userEvent.type(
      within(dialog).getByLabelText("Данс эзэмшигчийн нэр"),
      "Бат",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: /Захиалга цуцлах/ }),
    );
    expect(await within(dialog).findByText(/Хүргэх өдөр эхэлсэн/)).toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("OrderActions — unpaid order", () => {
  it("confirms plainly and cancels without an account", async () => {
    const fetch = stubFetch();
    render(
      <OrderActions
        orderId="o1"
        items={[]}
        cancellable
        paid={false}
        total={100_000}
      />,
    );
    expect(screen.queryByText(FEE)).toBeNull();

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

  it("hides the note once the order can no longer be cancelled", () => {
    render(
      <OrderActions
        orderId="o1"
        items={[]}
        cancellable={false}
        paid
        total={100_000}
      />,
    );
    expect(screen.queryByText(FEE)).toBeNull();
  });
});

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PaymentPanel } from "./payment-panel";
import { formatDeliveryDay } from "@/lib/time";
import type { PaymentView } from "../types";

/**
 * The payment page's three states.
 *
 * The pending state is the one worth pinning down: it is what a customer sees
 * while the money is still outstanding, and the whole point of the page is
 * that it must not read as a receipt for an order that is still `pending`.
 */

vi.mock("@/lib/analytics", () => ({ trackPurchase: vi.fn() }));

/**
 * jsdom answers every media query with "no match", which for
 * `(pointer: coarse)` means *desktop* — the opposite of the setup file's
 * intended mobile baseline. These tests are a phone unless they say otherwise.
 */
function stubPointer(coarse: boolean) {
  // Assigned on `window` rather than via `vi.stubGlobal`: setup.ts already
  // defined an own `window.matchMedia`, and that is the reference the hook
  // reads.
  window.matchMedia = ((query: string) => ({
    matches: query.includes("pointer: coarse") ? coarse : false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

const DEEPLINKS = [
  {
    name: "Khan bank",
    link: "khanbank://q?qPay_QRcode=x",
    logo: "https://qpay.mn/q/logo/khanbank.png",
  },
  { name: "Trade and Development bank", link: "tdbbank://q?qPay_QRcode=x" },
  { name: "Tino", link: "tino://q?qPay_QRcode=x" },
];

function view(over: Partial<PaymentView> = {}): PaymentView {
  return {
    orderNo: "VS-1042",
    total: 45000,
    paymentMethod: "qpay",
    paid: false,
    cancelled: false,
    deliverOn: "2026-09-09",
    invoice: {
      invoiceId: "inv_42",
      amount: 45000,
      qrText: "0002010102121531…",
      qrImage: "data:image/png;base64,AAAA",
      shortUrl: "https://s.qpay.mn/abc",
      deeplinks: DEEPLINKS,
    },
    mock: false,
    ...over,
  };
}

beforeEach(() => {
  stubPointer(true);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ paid: false }),
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("pending payment", () => {
  it("leads with the amount and reads as unpaid", () => {
    render(<PaymentPanel view={view()} token="tok" />);

    expect(
      screen.getByRole("heading", { level: 1, name: /45,000₮/ }),
    ).toBeTruthy();
    expect(screen.getByText(/Төлбөр хүлээгдэж байна/)).toBeTruthy();
    // The old page opened with "Захиалга баталгаажлаа" over an unpaid invoice.
    expect(screen.queryByText(/Төлбөр амжилттай/)).toBeNull();
    expect(screen.queryByText(/баталгаажлаа/)).toBeNull();
  });

  it("offers no way off the page while the payment is outstanding", () => {
    // Every exit here is an invitation to abandon a checkout mid-payment.
    render(<PaymentPanel view={view()} token="tok" />);

    expect(screen.queryByText("Захиалгаа хянах")).toBeNull();
    expect(screen.queryByText(/автоматаар хянаж байна/)).toBeNull();
  });

  it("carries no explanatory copy around the payment options", () => {
    // The page was trimmed to the amount, the apps, the QR and the action —
    // the group headings and the button labels already say everything these
    // sentences repeated.
    render(<PaymentPanel view={view()} token="tok" />);

    expect(screen.queryByText(/Банкны аппаа сонгоно уу/)).toBeNull();
    expect(
      screen.queryByText(/картын мэдээлэл бидэнд хадгалагдахгүй/),
    ).toBeNull();
    expect(screen.queryByText(/минут нөөцлөгдсөн/)).toBeNull();
  });

  it("groups the apps the way QPay's own picker does", () => {
    render(<PaymentPanel view={view()} token="tok" />);

    // Банк leads Цахим хэтэвч, and each app sits under its own heading.
    const headings = screen
      .getAllByRole("heading", { level: 3 })
      .map((h) => h.textContent);
    expect(headings).toEqual(["Банк", "Цахим хэтэвч"]);
  });

  it("renders one link per deeplink, locally named and ordered", () => {
    render(<PaymentPanel view={view()} token="tok" />);

    const khan = screen.getByRole("link", { name: /Хаан банк аппаар төлөх/ });
    expect(khan.getAttribute("href")).toBe("khanbank://q?qPay_QRcode=x");
    // QPay's "Trade and Development bank" becomes the name on the customer's
    // own phone, banks come before wallets, and Хаан outranks TDB.
    const links = screen.getAllByRole("link", { name: /аппаар төлөх/ });
    expect(links.map((a) => a.getAttribute("aria-label"))).toEqual([
      "Хаан банк аппаар төлөх",
      "TDB online аппаар төлөх",
      "Tino аппаар төлөх",
    ]);
  });

  it("pulls the last-used app to the top on a later visit", async () => {
    localStorage.setItem("vonscent-last-bank", "tdbbank");
    render(<PaymentPanel view={view()} token="tok" />);

    expect(await screen.findByText("Сүүлд хэрэглэсэн")).toBeTruthy();
    // Two links now point at TDB: the recent row and its tile in the grid.
    expect(
      screen.getAllByRole("link", { name: /TDB online аппаар төлөх/ }),
    ).toHaveLength(2);
    localStorage.clear();
  });

  it("shows the QR and the invoice reference", async () => {
    render(<PaymentPanel view={view()} token="tok" />);

    expect(screen.getByAltText("QPay QR код").getAttribute("src")).toBe(
      "data:image/png;base64,AAAA",
    );
    await userEvent.click(screen.getByText("Төлбөрийн дэлгэрэнгүй"));
    expect(screen.getByText("inv_42")).toBeTruthy();
  });

  it("reports back when a manual check finds no payment", async () => {
    render(<PaymentPanel view={view()} token="tok" />);

    await userEvent.click(
      screen.getByRole("button", { name: /Төлбөр шалгах/ }),
    );
    expect(fetch).toHaveBeenCalledWith(
      "/api/payments/status?token=tok&verify=1",
    );
    expect(
      await screen.findByText(/хараахан бүртгэгдээгүй байна/),
    ).toBeTruthy();
  });

  it("flips to the confirmed state once a check reports paid", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ paid: true }),
      }),
    );
    render(<PaymentPanel view={view()} token="tok" />);

    await userEvent.click(
      screen.getByRole("button", { name: /Төлбөр шалгах/ }),
    );
    expect(await screen.findByText("Төлбөр амжилттай")).toBeTruthy();
  });

  it("offers the mock confirm button only in mock mode", async () => {
    const { unmount } = render(<PaymentPanel view={view()} token="tok" />);
    expect(screen.queryByText(/mock/i)).toBeNull();
    unmount();

    render(
      <PaymentPanel
        view={view({
          mock: true,
          invoice: { ...view().invoice!, deeplinks: [] },
        })}
        token="tok"
      />,
    );
    expect(
      screen.getByRole("button", { name: /Төлбөр баталгаажуулах \(mock\)/ }),
    ).toBeTruthy();
    // Mock invoices carry no deeplinks, so the roster renders linkless rather
    // than leaving the page's main action an empty box.
    expect(screen.queryByRole("link", { name: /аппаар төлөх/ })).toBeNull();
    expect(screen.getByText("Хаан банк")).toBeTruthy();
    expect(
      screen.getByRole("heading", { level: 3, name: "Банк" }),
    ).toBeTruthy();
  });

  it("says so loudly when the QR asks for a test amount", () => {
    // A staff test order under QPAY_TEST_AMOUNT. An invoice that quietly
    // collects 10₮ is the bug this feature would be if it reached a customer.
    render(
      <PaymentPanel
        view={view({ invoice: { ...view().invoice!, amount: 10 } })}
        token="tok"
      />,
    );
    expect(screen.getByText(/Тест горим/)).toBeTruthy();
    expect(screen.getByText(/10₮ нэхнэ/)).toBeTruthy();
  });

  it("carries no test banner when the invoice matches the order", () => {
    render(<PaymentPanel view={view()} token="tok" />);
    expect(screen.queryByText(/Тест горим/)).toBeNull();
  });

  it("shows bank transfer details instead of QPay when that was chosen", () => {
    render(
      <PaymentPanel
        view={view({ paymentMethod: "bank_transfer", invoice: null })}
        token="tok"
      />,
    );
    expect(screen.getByText(/Банкны шилжүүлгээр төлөх/)).toBeTruthy();
    expect(screen.getByText("Гүйлгээний утга")).toBeTruthy();
    expect(screen.queryByAltText("QPay QR код")).toBeNull();
  });

  it("survives an invoice QPay never returned", () => {
    render(<PaymentPanel view={view({ invoice: null })} token="tok" />);
    expect(screen.getByText(/QPay-тэй холбогдож чадсангүй/)).toBeTruthy();
    expect(screen.getByText(/нөөцлөгдсөн хэвээр/)).toBeTruthy();
  });
});

describe("on a desktop", () => {
  beforeEach(() => stubPointer(false));

  it("stops rendering the app icons as links", () => {
    // A `khanbank://` click on a desktop produces a browser error, not a
    // payment — the icons stay as a legend for the QR.
    render(<PaymentPanel view={view()} token="tok" />);

    expect(screen.queryByRole("link", { name: /аппаар төлөх/ })).toBeNull();
    expect(screen.getByText("Хаан банк")).toBeTruthy();
    expect(screen.getByAltText("QPay QR код")).toBeTruthy();
  });

  it("drops the recently-used shortcut, which exists only to be tapped", () => {
    localStorage.setItem("vonscent-last-bank", "khanbank");
    render(<PaymentPanel view={view()} token="tok" />);

    expect(screen.queryByText("Сүүлд хэрэглэсэн")).toBeNull();
    localStorage.clear();
  });
});

describe("resolved states", () => {
  it("confirms a paid order with its delivery day", () => {
    render(<PaymentPanel view={view({ paid: true })} token="tok" />);
    expect(screen.getByText("Төлбөр амжилттай")).toBeTruthy();
    // Asserted through the formatter, not a literal: it says "Маргааш (…)"
    // for the next day, so a hard-coded string would break with the calendar.
    const card = screen.getByText(/цагт хүргэлтэд гарна/);
    expect(
      within(card).getByText(formatDeliveryDay("2026-09-09")),
    ).toBeTruthy();
    // Nothing to pay any more.
    expect(screen.queryByAltText("QPay QR код")).toBeNull();
  });

  it("explains a cancelled order rather than offering the QR", () => {
    render(<PaymentPanel view={view({ cancelled: true })} token="tok" />);
    expect(screen.getByText("Захиалга цуцлагдсан")).toBeTruthy();
    expect(screen.queryByAltText("QPay QR код")).toBeNull();
    expect(screen.queryByRole("link", { name: /аппаар төлөх/ })).toBeNull();
  });
});

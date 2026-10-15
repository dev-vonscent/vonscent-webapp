import { act, render, screen } from "@testing-library/react";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { PopupSettings } from "@/features/content/api";

const settings: PopupSettings = {
  enabled: true,
  slides: [
    {
      imageUrl: "https://x/a.webp",
      href: "",
      startsAt: null,
      endsAt: null,
      audience: "all",
    },
  ],
};

const guestOnly: PopupSettings = {
  enabled: true,
  slides: [{ ...settings.slides[0], audience: "guests" }],
};

type Auth = "guest" | "member" | "loading";

/** `shownForThisDocument` модулийн түвшинд — тест бүрд шинэ модуль. */
/**
 * jsdom-д dispatchEvent нь үргэлж `isTrusted=false` тул `trusted` үед
 * `isUserInput`-ийг хэрэглэгчийн үйлдэл гэж үзүүлнэ.
 */
async function renderPopup({
  trusted = true,
  auth = "guest" as Auth,
  popup = settings,
} = {}) {
  vi.resetModules();
  vi.doMock("@/features/account/use-profile-summary", () => ({
    useProfileSummary: () => ({
      profile:
        auth === "member"
          ? { name: "Бат", handle: "99112233", avatar: null, isStaff: false }
          : null,
      loading: auth === "loading",
      configured: true,
    }),
  }));
  vi.doMock("../popup-schedule", async (orig) => ({
    ...(await orig<typeof import("../popup-schedule")>()),
    isUserInput: (e: Event) => trusted || e.isTrusted,
  }));
  const { PromoPopup } = await import("./promo-popup");
  render(<PromoPopup settings={popup} />);
}

// Embla хэмжээ ажиглахад ResizeObserver хэрэглэдэг — jsdom-д байхгүй.
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

describe("PromoPopup", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("хэрэглэгч харьцаагүй бол гарахгүй (LCP болохгүй)", async () => {
    await renderPopup();
    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("код өдөөсөн (isTrusted=false) товч дарахад гарахгүй", async () => {
    await renderPopup({ trusted: false });
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("гүйлгэлтийн байрлал сэргээгдэхэд (scroll) гарахгүй", async () => {
    await renderPopup();
    await act(async () => {
      window.dispatchEvent(new Event("scroll"));
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("хулганы дугуйгаар гүйлгэхэд гарна", async () => {
    await renderPopup();
    await act(async () => {
      window.dispatchEvent(new WheelEvent("wheel", { deltaY: 100 }));
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("товч дарахад ч гарна", async () => {
    await renderPopup();
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("«Зөвхөн зочин» зар зочинд гарна", async () => {
    await renderPopup({ popup: guestOnly });
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("«Зөвхөн зочин» зар нэвтэрсэн хэрэглэгчид гарахгүй", async () => {
    await renderPopup({ popup: guestOnly, auth: "member" });
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
      vi.advanceTimersByTime(500);
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("нэвтэрсэн эсэх тодорхойгүй үед зочны зар гарахгүй", async () => {
    await renderPopup({ popup: guestOnly, auth: "loading" });
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
      vi.advanceTimersByTime(500);
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

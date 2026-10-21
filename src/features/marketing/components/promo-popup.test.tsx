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

/** `documentLoaded` модулийн түвшинд — тест бүрд шинэ модуль. */
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
  const view = render(<PromoPopup settings={popup} />);
  return { PromoPopup, view };
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

  it("харьцаагүй ч хуудас ачаалагдсаны дараа өөрөө гарна (refresh бүрд)", async () => {
    await renderPopup();
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("анхны үйлдэл нь чат бол гарахгүй", async () => {
    await renderPopup();
    const chat = document.createElement("button");
    chat.setAttribute("data-chat-entry", "");
    document.body.append(chat);
    await act(async () => {
      chat.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true }));
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    chat.remove();
  });

  it("код өдөөсөн (isTrusted=false) товч нь шууд нээхгүй", async () => {
    await renderPopup({ trusted: false });
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
      vi.advanceTimersByTime(500);
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("гүйлгэлтийн байрлал сэргээгдэх (scroll) нь шууд нээхгүй", async () => {
    await renderPopup();
    await act(async () => {
      window.dispatchEvent(new Event("scroll"));
      vi.advanceTimersByTime(500);
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

  it("сайт дотроос нүүр рүү буцаж ирэхэд үйлдэлгүйгээр дахин гарна", async () => {
    const { PromoPopup, view } = await renderPopup();
    await act(async () => {
      window.dispatchEvent(new WheelEvent("wheel", { deltaY: 100 }));
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByRole("dialog")).toBeTruthy();

    // Нүүрээс гараад (unmount) буцаж ирлээ (шинэ mount, ижил document).
    view.unmount();
    render(<PromoPopup settings={settings} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("мэндчилгээний цонх нээгдсэн бол дараагийн нэг нээлтийг алгасна", async () => {
    await renderPopup();
    const { suppressPromoPopup } = await import("./promo-popup");
    suppressPromoPopup();
    await act(async () => {
      window.dispatchEvent(new WheelEvent("wheel", { deltaY: 100 }));
      vi.advanceTimersByTime(500);
    });
    expect(screen.queryByRole("dialog")).toBeNull();
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

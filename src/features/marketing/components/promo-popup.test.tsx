import { act, render, renderHook, screen } from "@testing-library/react";
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
  beforeEach(() => {
    vi.useFakeTimers();
    window.sessionStorage.clear();
  });
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

  /** Эхний нээлтийг дуусгаад нүүрээс гарна (ижил document, шинэ mount-д бэлэн). */
  async function openThenLeave() {
    const ctx = await renderPopup();
    await act(async () => {
      window.dispatchEvent(new WheelEvent("wheel", { deltaY: 100 }));
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByRole("dialog")).toBeTruthy();
    ctx.view.unmount();
    return ctx;
  }

  it("сайт дотроос нүүр рүү буцахад дахин гарахгүй, teaser үлдэнэ", async () => {
    const { PromoPopup } = await openThenLeave();
    render(<PromoPopup settings={settings} />);
    await act(async () => {
      window.dispatchEvent(new WheelEvent("wheel", { deltaY: 100 }));
      vi.advanceTimersByTime(3000);
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Зар" })).toBeTruthy();
  });

  it("reload (шинэ document) хийхэд ч энэ session-д дахин гарахгүй", async () => {
    await openThenLeave();
    // renderPopup нь модулийг шинээр ачаална = reload.
    await renderPopup();
    await act(async () => {
      window.dispatchEvent(new WheelEvent("wheel", { deltaY: 100 }));
      vi.advanceTimersByTime(3000);
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("админ өөр зар тавьбал session-д харсан ч дахин гарна", async () => {
    await openThenLeave();
    await renderPopup({
      popup: {
        enabled: true,
        slides: [{ ...settings.slides[0], imageUrl: "https://x/b.webp" }],
      },
    });
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("нүүр анх mount болоход гараагүй бол client navigation-аар орж ирэхэд шууд гарна", async () => {
    const { PromoPopup, view } = await renderPopup();
    view.unmount(); // popup гарахаас өмнө өөр хуудас руу гарсан
    render(<PromoPopup settings={settings} />);
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("teaser дарахад popup дахин нээгдэнэ, × дарвал нуугдана", async () => {
    await renderPopup();
    await act(async () => {
      window.dispatchEvent(new WheelEvent("wheel", { deltaY: 100 }));
      vi.advanceTimersByTime(500);
    });
    // Хаах (Escape).
    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
      vi.advanceTimersByTime(500);
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    const teaser = screen.getByRole("button", { name: "Зар" });
    await act(async () => {
      teaser.click();
    });
    expect(screen.getByRole("dialog")).toBeTruthy();
    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
      vi.advanceTimersByTime(500);
    });
    await act(async () => {
      screen.getByRole("button", { name: "Зарын товчийг нуух" }).click();
    });
    expect(screen.queryByRole("button", { name: "Зар" })).toBeNull();
  });

  it("teaser доод цэсийг дагана: цэс нуугдахад бууж хумигдана", async () => {
    await renderPopup();
    await act(async () => {
      window.dispatchEvent(new WheelEvent("wheel", { deltaY: 100 }));
      vi.advanceTimersByTime(500);
    });
    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
      vi.advanceTimersByTime(500);
    });
    // `renderPopup` модулиудыг шинэчилдэг — store-ийг ижил instance-аас авна.
    const { usePublishScrollHidden } =
      await import("@/components/shared/bottom-nav-store");
    const header = renderHook(
      ({ hidden, atEnd }) => usePublishScrollHidden(hidden, atEnd),
      { initialProps: { hidden: false, atEnd: false } },
    );
    const hide = () =>
      screen.getByRole("button", { name: "Зарын товчийг нуух" });
    const isHidden = /(^|\s)hidden(\s|$)/;
    expect(hide().className).not.toMatch(isHidden);
    act(() => header.rerender({ hidden: true, atEnd: false }));
    // Хумигдсан ч нэр нь «Зар» хэвээр (дэлгэц уншигч).
    expect(screen.getByRole("button", { name: "Зар" })).toBeTruthy();
    expect(hide().className).toMatch(isHidden);
    // Хуудасны төгсгөлд цэс гарахад teaser ч дээшилж дэлгэгдэнэ.
    act(() => header.rerender({ hidden: true, atEnd: true }));
    expect(hide().className).not.toMatch(isHidden);
    header.unmount();
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

  it("цэс / сагс нээлттэй бол давхарлахгүй, хаагдсаны дараа гарна", async () => {
    await renderPopup();
    const sheet = document.createElement("div");
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("data-state", "open");
    document.body.append(sheet);
    await act(async () => {
      window.dispatchEvent(new WheelEvent("wheel", { deltaY: 100 }));
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    sheet.remove();
    await act(async () => {
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

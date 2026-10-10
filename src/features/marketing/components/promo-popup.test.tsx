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
    { imageUrl: "https://x/a.webp", href: "", startsAt: null, endsAt: null },
  ],
};

/** `shownForThisDocument` модулийн түвшинд — тест бүрд шинэ модуль. */
async function renderPopup() {
  vi.resetModules();
  const { PromoPopup } = await import("./promo-popup");
  render(<PromoPopup settings={settings} />);
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

  it("анх гүйлгэсний дараа гарна", async () => {
    await renderPopup();
    await act(async () => {
      window.dispatchEvent(new Event("scroll"));
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
});

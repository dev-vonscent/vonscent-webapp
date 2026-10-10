import { afterEach, describe, expect, it, vi } from "vitest";
import type { PopupSlide } from "@/features/content/api";
import { firstPopupImage, isLive, liveSlides } from "./popup-schedule";

const slide = (p: Partial<PopupSlide>): PopupSlide => ({
  imageUrl: "https://x/a.webp",
  href: "",
  startsAt: null,
  endsAt: null,
  ...p,
});
const NOW = new Date("2026-10-11T12:00:00Z").getTime();

afterEach(() => vi.useRealTimers());

describe("popup-schedule", () => {
  it("хуваарийн цонхонд л харагдана", () => {
    expect(isLive(slide({}), NOW)).toBe(true);
    expect(isLive(slide({ startsAt: "2026-10-12T00:00:00Z" }), NOW)).toBe(
      false,
    );
    expect(isLive(slide({ endsAt: "2026-10-10T00:00:00Z" }), NOW)).toBe(false);
  });

  it("зураггүй слайдыг хасна", () => {
    expect(
      liveSlides([slide({ imageUrl: null }), slide({})], NOW),
    ).toHaveLength(1);
  });

  it("эхний харагдах слайдын зургийг preload-д өгнө", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const slides = [
      slide({ imageUrl: "https://x/old.webp", endsAt: "2026-10-01T00:00:00Z" }),
      slide({ imageUrl: "https://x/now.webp" }),
    ];
    expect(firstPopupImage({ enabled: true, slides })).toBe(
      "https://x/now.webp",
    );
    expect(firstPopupImage({ enabled: false, slides })).toBeNull();
    expect(firstPopupImage({ enabled: true, slides: [] })).toBeNull();
  });
});

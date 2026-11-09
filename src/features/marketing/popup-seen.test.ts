// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import type { PopupSlide } from "@/features/content/api";
import {
  hideTeaser,
  isTeaserHidden,
  markPopupSeen,
  popupSignature,
  wasPopupSeen,
} from "./popup-seen";

const slide: PopupSlide = {
  imageUrl: "https://x/a.webp",
  href: "/catalog",
  startsAt: null,
  endsAt: null,
  audience: "all",
};

describe("popup-seen", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("харсан зар л тэмдэглэгдэнэ", () => {
    const sig = popupSignature([slide]);
    expect(wasPopupSeen(sig)).toBe(false);
    markPopupSeen(sig);
    expect(wasPopupSeen(sig)).toBe(true);
  });

  it("зураг эсвэл холбоос солигдвол шинэ зар гэж үзнэ", () => {
    markPopupSeen(popupSignature([slide]));
    expect(wasPopupSeen(popupSignature([{ ...slide, href: "/x" }]))).toBe(
      false,
    );
    expect(
      wasPopupSeen(popupSignature([slide, { ...slide, imageUrl: "b" }])),
    ).toBe(false);
  });

  it("teaser-ийг зар тус бүрээр нууна", () => {
    const sig = popupSignature([slide]);
    hideTeaser(sig);
    expect(isTeaserHidden(sig)).toBe(true);
    expect(isTeaserHidden("other")).toBe(false);
  });
});

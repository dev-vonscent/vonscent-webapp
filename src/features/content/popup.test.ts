import { describe, expect, it } from "vitest";
import { normalizePopup } from "./api";

describe("normalizePopup (backlog G1/G2)", () => {
  it("хоосон / буруу утгыг унтраалттай, слайдгүй болгоно", () => {
    expect(normalizePopup(null)).toEqual({ enabled: false, slides: [] });
    expect(normalizePopup({ enabled: "yes", slides: "x" })).toEqual({
      enabled: false,
      slides: [],
    });
  });

  it("зураггүй слайдыг хаяж, зурагтайг шинэ хэлбэрт оруулна", () => {
    const out = normalizePopup({
      enabled: true,
      frequencyHours: 24,
      slides: [
        { title: "Текст л", imageUrl: null, ctaHref: "/catalog" },
        {
          imageUrl: "https://cdn/x.webp",
          href: " /catalog?tags=sale ",
          startsAt: "2026-06-01T00:00:00.000Z",
          endsAt: null,
        },
      ],
    });
    expect(out).toEqual({
      enabled: true,
      slides: [
        {
          imageUrl: "https://cdn/x.webp",
          href: "/catalog?tags=sale",
          startsAt: "2026-06-01T00:00:00.000Z",
          endsAt: null,
        },
      ],
    });
  });

  it("G2-оос өмнөх слайдын CTA холбоос → href, бусад талбар хаягдана", () => {
    const out = normalizePopup({
      enabled: true,
      slides: [
        {
          title: "Шинэ багц",
          body: "…",
          ctaLabel: "Үзэх",
          ctaHref: "/collections",
          imageUrl: "https://cdn/old.webp",
          couponCode: "SUMMER10",
        },
      ],
    });
    expect(out.slides).toEqual([
      {
        imageUrl: "https://cdn/old.webp",
        href: "/collections",
        startsAt: null,
        endsAt: null,
      },
    ]);
  });
});

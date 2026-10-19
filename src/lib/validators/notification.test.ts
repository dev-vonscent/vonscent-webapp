import { describe, expect, it } from "vitest";
import {
  broadcastFieldErrors,
  broadcastInputSchema,
  broadcastSendSchema,
  isInternalNotificationUrl,
  isSafeNotificationUrl,
  notificationFeedQuerySchema,
  notificationReadSchema,
} from "./notification";

describe("isSafeNotificationUrl", () => {
  it.each([
    "/catalog",
    "/products/dior-sauvage?size=5",
    "/account/orders?tab=saved",
    "https://instagram.com/vonscent.mn",
    "https://vonscent.mn/campaigns/x#top",
  ])("зөвшөөрнө: %s", (url) => {
    expect(isSafeNotificationUrl(url)).toBe(true);
  });

  it.each([
    "",
    "catalog",
    "//evil.com",
    "/\\evil.com",
    "http://vonscent.mn",
    "javascript:alert(1)",
    "JAVASCRIPT:alert(1)",
    "data:text/html,hi",
    "https://user:pass@evil.com",
    "https://user@evil.com",
    "/catalog\nSet-Cookie",
    "/ca\ttalog",
    " /catalog",
    "https://",
  ])("татгалзана: %j", (url) => {
    expect(isSafeNotificationUrl(url)).toBe(false);
  });
});

describe("isInternalNotificationUrl", () => {
  it("дотоод зам ба гадаад хаягийг ялгана", () => {
    expect(isInternalNotificationUrl("/lucky-wheel")).toBe(true);
    expect(isInternalNotificationUrl("//evil.com")).toBe(false);
    expect(isInternalNotificationUrl("https://vonscent.mn")).toBe(false);
  });
});

describe("notificationReadSchema", () => {
  it("ids эсвэл all", () => {
    const id = "6f1c1f9e-7d1a-4f43-9a3c-6a1d2b3c4d5e";
    expect(notificationReadSchema.safeParse({ ids: [id] }).success).toBe(true);
    expect(notificationReadSchema.safeParse({ all: true }).success).toBe(true);
  });

  it("хоосон, буруу id, all=false, илүү талбар — татгалзана", () => {
    expect(notificationReadSchema.safeParse({ ids: [] }).success).toBe(false);
    expect(notificationReadSchema.safeParse({ ids: ["x"] }).success).toBe(
      false,
    );
    expect(notificationReadSchema.safeParse({ all: false }).success).toBe(
      false,
    );
    expect(
      notificationReadSchema.safeParse({ all: true, userId: "x" }).success,
    ).toBe(false);
  });
});

describe("notificationFeedQuerySchema", () => {
  it("limit анхдагч 20, 1–50", () => {
    expect(notificationFeedQuerySchema.parse({}).limit).toBe(20);
    expect(notificationFeedQuerySchema.parse({ limit: "5" }).limit).toBe(5);
    expect(notificationFeedQuerySchema.safeParse({ limit: "0" }).success).toBe(
      false,
    );
    expect(notificationFeedQuerySchema.safeParse({ limit: "51" }).success).toBe(
      false,
    );
  });
});

describe("broadcastInputSchema", () => {
  const base = { kind: "announcement", title: "Шинэ үнэртэн ирлээ" };

  it("анхдагч утга, trim", () => {
    expect(
      broadcastInputSchema.parse({ ...base, title: "  Сайн уу  " }),
    ).toEqual({
      kind: "announcement",
      title: "Сайн уу",
      body: "",
      url: "",
      imageUrl: null,
    });
  });

  it("гарчиг 1–80, текст ≤300", () => {
    expect(
      broadcastInputSchema.safeParse({ ...base, title: "  " }).success,
    ).toBe(false);
    expect(
      broadcastInputSchema.safeParse({ ...base, title: "x".repeat(81) })
        .success,
    ).toBe(false);
    expect(
      broadcastInputSchema.safeParse({ ...base, body: "x".repeat(301) })
        .success,
    ).toBe(false);
  });

  it("хувийн төрөл (order_paid г.м.) админаас сонгогдохгүй", () => {
    expect(
      broadcastInputSchema.safeParse({ ...base, kind: "order_paid" }).success,
    ).toBe(false);
  });

  it("холбоос: хоосон, дотоод зам, https — бусад нь алдаа талбартайгаа", () => {
    expect(
      broadcastInputSchema.safeParse({ ...base, url: "/catalog" }).success,
    ).toBe(true);
    expect(
      broadcastInputSchema.safeParse({ ...base, url: "https://x.mn" }).success,
    ).toBe(true);
    const bad = broadcastInputSchema.safeParse({ ...base, url: "//evil.com" });
    expect(bad.success).toBe(false);
    if (!bad.success) expect(broadcastFieldErrors(bad.error).url).toBeTruthy();
  });
});

describe("broadcastSendSchema", () => {
  it("publishAt null = одоо, offset-тэй ISO", () => {
    expect(broadcastSendSchema.parse({}).publishAt).toBeNull();
    expect(
      broadcastSendSchema.safeParse({ publishAt: "2026-10-20T06:00:00.000Z" })
        .success,
    ).toBe(true);
    expect(
      broadcastSendSchema.safeParse({ publishAt: "2026-10-20" }).success,
    ).toBe(false);
  });
});

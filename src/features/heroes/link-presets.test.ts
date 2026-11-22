import { describe, expect, it } from "vitest";
import { HERO_LINK_PRESETS } from "@/lib/constants";
import { heroTargetSchema } from "@/lib/validators/hero";
import {
  CUSTOM_LINK_KEY,
  EVENT_LINK_KEY,
  heroLinkOptions,
  linkOptionKey,
  rebindEventTarget,
} from "./link-presets";

describe("HERO_LINK_PRESETS", () => {
  it.each(HERO_LINK_PRESETS.map((p) => [p.key, p.target]))(
    "%s нь heroTargetSchema-д хүчинтэй",
    (_key, target) => {
      expect(heroTargetSchema.safeParse(target).success).toBe(true);
    },
  );

  it("түлхүүр давхардахгүй", () => {
    const keys = HERO_LINK_PRESETS.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("heroLinkOptions", () => {
  it("арга хэмжээ эхэнд; хаалттай тугийн хуудас гарахгүй", () => {
    const opts = heroLinkOptions({ eventSlug: "bf", isEnabled: () => false });
    expect(opts[0]).toMatchObject({
      key: EVENT_LINK_KEY,
      target: { type: "event", slug: "bf" },
    });
    expect(opts.some((o) => o.key === "gift-cards")).toBe(false);
    const on = heroLinkOptions({ isEnabled: (f) => f === "gift_cards" });
    expect(on.some((o) => o.key === "gift-cards")).toBe(true);
    expect(on.some((o) => o.key === EVENT_LINK_KEY)).toBe(false);
  });
});

describe("heroLinkOptions + арга хэмжээ (тусгай өдөр)", () => {
  it("арга хэмжээнүүд төгсгөлд, таарна", () => {
    const opts = heroLinkOptions({ isEnabled: () => false, events: [{ slug: "bf", name: "Black Friday" }] });
    expect(opts.at(-1)).toMatchObject({ key: "event:bf", label: "Арга хэмжээ: Black Friday" });
    expect(linkOptionKey({ type: "event", slug: "bf" }, opts)).toBe("event:bf");
  });
});

describe("linkOptionKey", () => {
  const opts = heroLinkOptions({ eventSlug: "bf", isEnabled: () => true });
  it("таарсан сонголт", () => {
    expect(linkOptionKey({ type: "event", slug: "bf" }, opts)).toBe(EVENT_LINK_KEY);
    expect(linkOptionKey({ type: "season", value: "winter" }, opts)).toBe(
      "season-winter",
    );
    expect(linkOptionKey({ type: "catalog", query: "?tags=new" }, opts)).toBe("new");
  });
  it("таарахгүй бол «Өөр хуудас…»", () => {
    expect(linkOptionKey({ type: "path", href: "/blog" }, opts)).toBe(CUSTOM_LINK_KEY);
    expect(linkOptionKey({ type: "event", slug: "other" }, opts)).toBe(CUSTOM_LINK_KEY);
  });
});

describe("rebindEventTarget", () => {
  it("хуучин slug руу заасныг шинэ рүү", () => {
    expect(rebindEventTarget({ type: "event", slug: "a" }, ["a"], "b")).toEqual({
      type: "event",
      slug: "b",
    });
  });
  it("өөр зорилт, null хэвээр", () => {
    expect(rebindEventTarget({ type: "event", slug: "x" }, ["a"], "b")).toEqual({
      type: "event",
      slug: "x",
    });
    expect(rebindEventTarget({ type: "path", href: "/" }, ["a"], "b")).toEqual({
      type: "path",
      href: "/",
    });
    expect(rebindEventTarget(null, ["a"], "b")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { HERO_PHOTO } from "@/features/marketing/home-content";
import {
  canvasPreview,
  heroCanvasComplete,
  heroCanvasMissing,
  viewFields,
  withHeroField,
  type HeroCanvasDraft,
} from "./canvas-model";

const draft = (over: Partial<HeroCanvasDraft> = {}): HeroCanvasDraft => ({
  eyebrow: "",
  title: "Black Friday",
  description: "Тайлбар",
  mobileDescription: "",
  primaryLabel: "Үзэх",
  primaryTarget: { type: "event", slug: "bf" },
  secondaryLabel: "",
  secondaryTarget: null,
  desktopImage: null,
  mobileImage: null,
  imageAlt: "",
  dark: true,
  ...over,
});

describe("canvasPreview", () => {
  it("хоосон сонголтот талбарт орлуулагч, заавал талбар улаан", () => {
    const p = canvasPreview(draft({ title: " ", primaryLabel: "" }));
    expect(p.campaign.eyebrow).toBe("+ Дээд мөр нэмэх");
    expect(p.campaign.secondary?.label).toBe("+ Нэмэлт товч");
    expect(p.placeholders).toEqual(
      expect.arrayContaining(["eyebrow", "title", "primary", "secondary"]),
    );
    expect(p.invalid).toEqual(["title", "primary"]);
  });

  it("утасны тайлбар хоосон бол компьютерынх бүдгээр", () => {
    const p = canvasPreview(draft());
    expect(p.campaign.mobileDescription).toBe("Тайлбар");
    expect(p.placeholders).toContain("mobileDescription");
    const both = canvasPreview(draft({ description: "" }));
    expect(both.campaign.mobileDescription).toBeUndefined();
  });

  it("зураггүй бол жишээ зураг, цайвар хана", () => {
    const p = canvasPreview(draft());
    expect(p.sample).toEqual({ desktop: true, mobile: true });
    expect(p.campaign.image).toMatchObject({ src: HERO_PHOTO.src, dark: false });
  });

  it("зөвхөн харах үед орлуулагчгүй, нэмэлт товчгүй", () => {
    const p = canvasPreview(draft(), "view");
    expect(p.campaign.eyebrow).toBe("");
    expect(p.campaign.secondary).toBeUndefined();
    expect(p.placeholders).toEqual([]);
  });

  it("товчны холбоос URL болно", () => {
    expect(canvasPreview(draft()).campaign.primary.href).toBe("/catalog?event=bf");
  });
});

describe("withHeroField", () => {
  it("нэмэлт товч бичигдэхэд каталог руу, хоослоход хасагдана", () => {
    const on = withHeroField(draft(), "secondary", "Бүгд");
    expect(on.secondaryTarget).toEqual({ type: "path", href: "/catalog" });
    expect(withHeroField(on, "secondary", "").secondaryTarget).toBeNull();
    expect(withHeroField(draft(), "primary", "Шинэ").primaryLabel).toBe("Шинэ");
  });
});

describe("viewFields", () => {
  it("утсанд нэмэлт товч ба компьютерын тайлбар засагдахгүй", () => {
    expect(viewFields("mobile")).not.toContain("secondary");
    expect(viewFields("mobile")).toContain("mobileDescription");
    expect(viewFields("desktop")).not.toContain("mobileDescription");
  });
});

describe("heroCanvasComplete", () => {
  it("хоёр зураг + гарчиг + товч", () => {
    const img = { base: "b", widths: [1600], height1600: 571 };
    const mob = { src: "m", width: 1600, height: 1200 };
    expect(heroCanvasComplete(draft())).toBe(false);
    expect(heroCanvasComplete(draft({ desktopImage: img, mobileImage: mob }))).toBe(true);
    expect(
      heroCanvasComplete(draft({ desktopImage: img, mobileImage: mob, title: "" })),
    ).toBe(false);
  });
});

describe("heroCanvasMissing", () => {
  it("дутуу зүйлсийг дарааллаар нэрлэнэ", () => {
    expect(heroCanvasMissing(draft({ title: " " }))).toEqual([
      "компьютерын зураг",
      "утасны зураг",
      "гарчиг",
    ]);
    const img = { base: "b", widths: [1600], height1600: 571 };
    const mob = { src: "m", width: 1600, height: 1200 };
    expect(heroCanvasMissing(draft({ desktopImage: img, mobileImage: mob }))).toEqual([]);
  });
});

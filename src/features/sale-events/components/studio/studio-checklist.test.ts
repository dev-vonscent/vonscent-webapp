import { describe, expect, it } from "vitest";
import type { OverlapConflict } from "../../lib";
import {
  bannerGaps,
  bannerReady,
  firstProblem,
  hasBlocking,
  openingStep,
  stepStatus,
  studioBannerFor,
  studioChecklist,
  type StudioBanner,
} from "./studio-checklist";
import { visibleSteps, type StudioDraft } from "./studio-model";

const TODAY = "2026-11-13";
const P1 = "11111111-1111-4111-8111-111111111111";
const P2 = "22222222-2222-4222-8222-222222222222";

function draft(over: Partial<StudioDraft> = {}): StudioDraft {
  return {
    name: "Black Friday",
    slug: "black-friday",
    slugTouched: false,
    badgeLabel: "",
    headline: "",
    description: "",
    startsOn: "2026-11-23",
    endsOn: "2026-11-30",
    showCountdown: true,
    tickerTheme: null,
    items: [
      { productId: P1, pcts: { 5: "20" } },
      { productId: P2, pcts: { 5: "30" } },
    ],
    ...over,
  };
}

const BANNER: StudioBanner = {
  id: "h1",
  thumb: "https://x/hero/a-1600.webp",
  hasDesktop: true,
  hasMobile: true,
  hasTitle: true,
  hasPrimaryLabel: true,
  isActive: true,
  others: 0,
};

function conflict(productId: string, event: string): OverlapConflict {
  return {
    productId,
    product: "Layton",
    brand: "PDM",
    event,
    startsAt: "2026-11-20T16:00:00.000Z",
    endsAt: "2026-11-25T16:00:00.000Z",
  };
}

const levels = (items: ReturnType<typeof studioChecklist>, step: string) =>
  items.filter((i) => i.step === step).map((i) => i.level);

describe("studioChecklist", () => {
  it("бүрэн ноорог → бүгд ногоон, хориглох зүйлгүй", () => {
    const items = studioChecklist({ draft: draft(), today: TODAY });
    expect(items.map((i) => i.level)).toEqual(["ok", "ok", "ok"]);
    expect(items[1].text).toBe("2 бараа, хямдрал 20–30%");
    expect(hasBlocking(items)).toBe(false);
    expect(firstProblem(items)).toBeNull();
  });

  it("бараагүй → улаан", () => {
    const items = studioChecklist({
      draft: draft({ items: [] }),
      today: TODAY,
    });
    expect(levels(items, "products")).toEqual(["error"]);
    expect(hasBlocking(items)).toBe(true);
  });

  it("буруу хувь → улаан", () => {
    const items = studioChecklist({
      draft: draft({ items: [{ productId: P1, pcts: { 5: "120" } }] }),
      today: TODAY,
    });
    expect(levels(items, "products")).toEqual(["error"]);
    expect(items.find((i) => i.step === "products")?.text).toMatch(
      /1 барааны хувь буруу/,
    );
  });

  it("хугацаа буруу → улаан: дутуу, урвуу, өнгөрсөн", () => {
    const missing = studioChecklist({
      draft: draft({ endsOn: "" }),
      today: TODAY,
    });
    expect(missing[0]).toMatchObject({
      level: "error",
      text: "Хугацаа сонгоогүй",
    });
    const reversed = studioChecklist({
      draft: draft({ startsOn: "2026-11-30", endsOn: "2026-11-23" }),
      today: TODAY,
    });
    expect(reversed[0].text).toBe("Дуусах өдөр эхлэхээс өмнө байна");
    const past = studioChecklist({
      draft: draft({ startsOn: "2026-11-01", endsOn: "2026-11-05" }),
      today: TODAY,
    });
    expect(past[0].text).toBe("Дуусах өдөр өнгөрсөн байна");
    // Өнөөдөр дуусах нь хүчинтэй (23:59 хүртэл).
    const today = studioChecklist({
      draft: draft({ startsOn: "2026-11-10", endsOn: TODAY }),
      today: TODAY,
    });
    expect(today[0].level).toBe("ok");
  });

  it("нэр хоосон, холбоос буруу → тус тусдаа улаан мөр", () => {
    const items = studioChecklist({
      draft: draft({ name: " ", slug: "Буруу" }),
      today: TODAY,
    });
    expect(levels(items, "basics")).toEqual(["error", "error"]);
  });

  it("давхцал → арга хэмжээ бүрээр улаан, «Харах»", () => {
    const items = studioChecklist({
      draft: draft(),
      today: TODAY,
      conflicts: [conflict(P1, "Наадам"), conflict(P2, "Наадам")],
    });
    const row = items.find((i) => i.text.includes("давхцаж"));
    expect(row).toMatchObject({
      step: "products",
      level: "error",
      text: "2 бараа «Наадам» арга хэмжээтэй давхцаж байна",
      action: "Харах",
    });
    expect(hasBlocking(items)).toBe(true);
  });

  it("баннерын нэг зураг дутуу → улбар (хориглохгүй)", () => {
    const items = studioChecklist({
      draft: draft(),
      today: TODAY,
      bannerEnabled: true,
      banner: { ...BANNER, hasMobile: false },
    });
    expect(items.at(-1)).toMatchObject({
      step: "banner",
      level: "warn",
      text: "Нүүрний баннер — утасны зураг дутуу",
    });
    expect(hasBlocking(items)).toBe(false);
    expect(firstProblem(items)?.step).toBe("banner");
  });

  it("баннергүй → тэмдэглэл; бэлэн → ногоон; идэвхгүй → улбар", () => {
    const none = studioChecklist({
      draft: draft(),
      today: TODAY,
      bannerEnabled: true,
    });
    expect(none.at(-1)).toMatchObject({ step: "banner", level: "note" });
    const ready = studioChecklist({
      draft: draft(),
      today: TODAY,
      bannerEnabled: true,
      banner: BANNER,
    });
    expect(ready.at(-1)?.level).toBe("ok");
    const off = studioChecklist({
      draft: draft(),
      today: TODAY,
      bannerEnabled: true,
      banner: { ...BANNER, isActive: false },
    });
    expect(off.at(-1)?.level).toBe("warn");
  });

  it("hero_admin хаалттай → баннерын мөр байхгүй", () => {
    const items = studioChecklist({
      draft: draft(),
      today: TODAY,
      banner: BANNER,
    });
    expect(items.some((i) => i.step === "banner")).toBe(false);
  });

  it("улаан нь улбараас түрүүлж жагсаалтын картад гарна", () => {
    const items = studioChecklist({
      draft: draft({ items: [] }),
      today: TODAY,
      bannerEnabled: true,
      banner: { ...BANNER, hasMobile: false },
    });
    expect(firstProblem(items)?.level).toBe("error");
  });
});

describe("баннер", () => {
  it("дутуу зүйлс дарааллаараа", () => {
    expect(
      bannerGaps({
        ...BANNER,
        hasDesktop: false,
        hasMobile: false,
        hasTitle: false,
        hasPrimaryLabel: false,
      }),
    ).toEqual([
      "компьютерын зураг",
      "утасны зураг",
      "гарчиг",
      "гол товчны бичиг",
    ]);
    expect(bannerGaps(BANNER)).toEqual([]);
  });

  it("бэлэн = бүрэн ба идэвхтэй", () => {
    expect(bannerReady(BANNER)).toBe(true);
    expect(bannerReady({ ...BANNER, isActive: false })).toBe(false);
    expect(bannerReady({ ...BANNER, hasMobile: false })).toBe(false);
    expect(bannerReady(null)).toBe(false);
  });

  it("арга хэмжээний хамгийн сүүлд шинэчлэгдсэн мөр; бусдыг тоолно", () => {
    const hero = (
      id: string,
      saleEventId: string | null,
      updatedAt: string,
    ) => ({
      id,
      saleEventId,
      title: "T",
      primaryLabel: "",
      isActive: true,
      desktopImage: { base: `https://x/${id}` },
      mobileImage: null,
      updatedAt,
    });
    const heroes = [
      hero("old", "e1", "2026-11-01T00:00:00Z"),
      hero("new", "e1", "2026-11-10T00:00:00Z"),
      hero("other", "e2", "2026-11-12T00:00:00Z"),
      hero("free", null, "2026-11-13T00:00:00Z"),
    ];
    expect(studioBannerFor(heroes, "e1")).toEqual({
      id: "new",
      thumb: "https://x/new-1600.webp",
      hasDesktop: true,
      hasMobile: false,
      hasTitle: true,
      hasPrimaryLabel: false,
      isActive: true,
      others: 1,
    });
    expect(studioBannerFor(heroes, "e3")).toBeNull();
  });
});

describe("stepStatus (D2)", () => {
  const ok = studioChecklist({
    draft: draft(),
    today: TODAY,
    bannerEnabled: true,
    banner: BANNER,
  });

  it("шинэ (мөргүй) → бүгд хийгээгүй", () => {
    expect(stepStatus("basics", ok, null)).toBe("todo");
  });

  it("бэлэн алхам ✓; шалгах алхам нийтэлсний дараа ✓", () => {
    expect(stepStatus("basics", ok, "draft")).toBe("done");
    expect(stepStatus("banner", ok, "draft")).toBe("done");
    expect(stepStatus("review", ok, "draft")).toBe("todo");
    expect(stepStatus("review", ok, "scheduled")).toBe("done");
  });

  it("улаан / улбар → анхаарах; тэмдэглэл → хийгээгүй", () => {
    const bad = studioChecklist({
      draft: draft({ items: [] }),
      today: TODAY,
      bannerEnabled: true,
    });
    expect(stepStatus("products", bad, "draft")).toBe("attention");
    expect(stepStatus("banner", bad, "draft")).toBe("todo");
    const warn = studioChecklist({
      draft: draft(),
      today: TODAY,
      bannerEnabled: true,
      banner: { ...BANNER, hasMobile: false },
    });
    expect(stepStatus("banner", warn, "live")).toBe("attention");
  });
});

describe("openingStep (D2)", () => {
  const steps = visibleSteps(true);
  const full = studioChecklist({ draft: draft(), today: TODAY });
  const noItems = studioChecklist({
    draft: draft({ items: [] }),
    today: TODAY,
  });

  it("шинэ → ① (URL-ийн алхмыг үл тооно)", () => {
    expect(
      openingStep({ requested: "review", phase: null, items: noItems, steps }),
    ).toBe("basics");
  });

  it("URL-д алхам байвал тэр", () => {
    expect(
      openingStep({
        requested: "products",
        phase: "draft",
        items: full,
        steps,
      }),
    ).toBe("products");
  });

  it("дутуу ноорог → эхний дутуу алхам; бүрэн ноорог → ⑤", () => {
    expect(
      openingStep({ requested: null, phase: "draft", items: noItems, steps }),
    ).toBe("products");
    expect(
      openingStep({ requested: null, phase: "draft", items: full, steps }),
    ).toBe("review");
  });

  it("товлосон / явж буй / дууссан → ⑤", () => {
    for (const phase of ["scheduled", "live", "ended"] as const) {
      expect(
        openingStep({ requested: null, phase, items: noItems, steps }),
      ).toBe("review");
    }
  });
});

describe("хувьгүй бараа (клиент 2026-11-15)", () => {
  it("сонгосон бараа бүр хувьтай байх ёстой — нийтлэхийг хориглоно", () => {
    const items = studioChecklist({
      draft: draft({
        items: [
          { productId: P1, pcts: { 5: "20" } },
          { productId: P2, pcts: {} },
        ],
      }),
      today: TODAY,
    });
    const err = items.find((i) => i.step === "products" && i.level === "error");
    expect(err?.text).toMatch(/^1 бараанд хувь өгөөгүй/u);
    expect(hasBlocking(items)).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { saleEventInputSchema } from "@/lib/validators/sale-event";
import type { SaleEventAdminRow } from "../../types";
import {
  dayGenitive,
  dayWithWeekday,
  daysInclusive,
  discountRange,
  draftFromRow,
  draftToInput,
  emptyDraft,
  itemsSummary,
  parseStep,
  pctSpan,
  productsStepBlock,
  periodSentence,
  publishAction,
  saleLink,
  saveMode,
  studioTimeline,
  visibleSteps,
  withName,
  withSlug,
  type StudioDraft,
} from "./studio-model";

const P1 = "11111111-1111-4111-8111-111111111111";
const P2 = "22222222-2222-4222-8222-222222222222";

// 2026-11-23 00:00 УБ → 2026-12-01 00:00 УБ (exclusive) = 11/23–11/30.
const ROW: SaleEventAdminRow = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  slug: "black-friday",
  name: "Black Friday",
  badgeLabel: "Black Friday",
  headline: null,
  description: null,
  startsAt: "2026-11-22T16:00:00.000Z",
  endsAt: "2026-11-30T16:00:00.000Z",
  isActive: true,
  showCountdown: true,
  tickerTheme: "black",
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
  items: [
    { productId: P1, pcts: { "5": 20, "10": 30 } },
    { productId: P2, pcts: {} },
  ],
};

function draft(over: Partial<StudioDraft> = {}): StudioDraft {
  return { ...draftFromRow(ROW), ...over };
}

describe("draftFromRow / draftToInput", () => {
  it("мөр → ноорог: УБ-ийн өдөр, хувь мөр болно", () => {
    const d = draftFromRow(ROW);
    expect(d.startsOn).toBe("2026-11-23");
    expect(d.endsOn).toBe("2026-11-30");
    expect(d.slugTouched).toBe(true);
    expect(d.items[0].pcts).toEqual({ 5: "20", 10: "30" });
    expect(d.headline).toBe("");
  });

  it("хуулахад огноо хоосон, бусад нь хэвээр", () => {
    const d = draftFromRow(ROW, { copy: true });
    expect(d.startsOn).toBe("");
    expect(d.endsOn).toBe("");
    expect(d.items).toHaveLength(2);
    expect(d.badgeLabel).toBe("Black Friday");
  });

  it("ноорог → Zod-оор хүчинтэй оролт; хоосон хувь орохгүй", () => {
    const d = draft({
      items: [{ productId: P1, pcts: { 5: "20", 10: "", 20: " " } }],
    });
    const parsed = saleEventInputSchema.safeParse(draftToInput(d, true));
    expect(parsed.success).toBe(true);
    expect(parsed.data?.items[0].pcts).toEqual({ "5": 20 });
    expect(parsed.data?.isActive).toBe(true);
  });

  it("зурвасын өнгө: мөр → ноорог → оролт хэвээр; хуучин мөр (null) → null", () => {
    const d = draftFromRow(ROW);
    expect(d.tickerTheme).toBe("black");
    const parsed = saleEventInputSchema.safeParse(draftToInput(d, false));
    expect(parsed.data?.tickerTheme).toBe("black");
    const legacy = saleEventInputSchema.safeParse(
      draftToInput(draftFromRow({ ...ROW, tickerTheme: null }), false),
    );
    expect(legacy.data?.tickerTheme).toBeNull();
    // Бэлэн жагсаалтаас гадуурх утга орохгүй (дурын өнгө биш).
    expect(
      saleEventInputSchema.safeParse({
        ...(draftToInput(d, false) as object),
        tickerTheme: "#ff0000",
      }).success,
    ).toBe(false);
  });

  it("буруу хувийг чимээгүй алгасахгүй — Zod барина", () => {
    const d = draft({ items: [{ productId: P1, pcts: { 5: "abc" } }] });
    expect(saleEventInputSchema.safeParse(draftToInput(d, false)).success).toBe(
      false,
    );
  });

  it("бараагүй ноорог хадгалагдана, нийтлэгдэхгүй", () => {
    const d = draft({ items: [] });
    expect(saleEventInputSchema.safeParse(draftToInput(d, false)).success).toBe(
      true,
    );
    expect(saleEventInputSchema.safeParse(draftToInput(d, true)).success).toBe(
      false,
    );
  });
});

describe("холбоос (D5)", () => {
  it("нэрээс автоматаар; гараар өөрчилсөн бол дагахгүй", () => {
    const auto = withName(emptyDraft(), "Цагаан сар 2027");
    expect(auto.slug).toBe("tsagaan-sar-2027");
    const touched = withName(withSlug(auto, "TSAGAAN"), "Өөр нэр");
    expect(touched.slug).toBe("tsagaan");
    expect(touched.name).toBe("Өөр нэр");
  });

  it("харагдах ба хуулах хаяг", () => {
    expect(saleLink("black-friday")).toEqual({
      display: "vonscent.mn/sale/black-friday",
      url: "https://www.vonscent.mn/sale/black-friday",
    });
    expect(saleLink("").display).toBe("vonscent.mn/sale/…");
  });
});

describe("алхам, горим, товч", () => {
  it("hero_admin хаалттай бол ④ алга (4 алхам)", () => {
    expect(visibleSteps(true)).toHaveLength(5);
    expect(visibleSteps(false)).toEqual([
      "basics",
      "products",
      "catalog",
      "review",
    ]);
  });

  it("parseStep: үл мэдэгдэх / нуугдсан алхам → null", () => {
    expect(parseStep("catalog", visibleSteps(true))).toBe("catalog");
    expect(parseStep("banner", visibleSteps(false))).toBeNull();
    expect(parseStep("x", visibleSteps(true))).toBeNull();
    expect(parseStep(undefined, visibleSteps(true))).toBeNull();
  });

  it("хадгалалтын горим төлөвөөс (D7)", () => {
    expect(saveMode(null)).toBe("create");
    expect(saveMode("draft")).toBe("auto");
    expect(saveMode("scheduled")).toBe("manual");
    expect(saveMode("live")).toBe("manual");
    expect(saveMode("ended")).toBe("locked");
  });

  it("эхлэх өдөр ирээдүйд → товлох; өнөөдөр / өнгөрсөн → одоо эхлүүлэх", () => {
    expect(publishAction("2026-11-23", "2026-11-13")).toBe("schedule");
    expect(publishAction("2026-11-13", "2026-11-13")).toBe("start");
    expect(publishAction("2026-11-01", "2026-11-13")).toBe("start");
    expect(publishAction("", "2026-11-13")).toBe("schedule");
  });
});

describe("хувийн тойм", () => {
  it("хүчинтэй хувийн муж, хувьгүй ба буруу барааг тусад нь", () => {
    const r = discountRange([
      { pcts: { 5: "20", 10: "30" } },
      { pcts: { 5: "" } },
      { pcts: { 5: "95" } },
      { pcts: { 5: 25 } },
    ]);
    expect(r).toEqual({
      count: 4,
      withPct: 2,
      invalid: 1,
      noPct: 1,
      min: 20,
      max: 30,
    });
    expect(pctSpan(r)).toBe("20–30%");
  });

  it("нэг хувь / хувьгүй", () => {
    expect(pctSpan(discountRange([{ pcts: { 5: "20" } }]))).toBe("20%");
    expect(pctSpan(discountRange([{ pcts: {} }]))).toBeNull();
  });

  it("②-оос цааш: бараа бүр дор хаяж нэг хувьтай", () => {
    expect(productsStepBlock([])).toBeNull();
    expect(productsStepBlock([{ pcts: { 5: "20" } }])).toBeNull();
    expect(productsStepBlock([{ pcts: { 5: "20" } }, { pcts: {} }])).toMatch(
      /^1 бараанд хувь өгөөгүй/u,
    );
    expect(productsStepBlock([{ pcts: { 5: "", 10: " " } }])).toMatch(
      /хувь өгөөгүй/u,
    );
    expect(productsStepBlock([{ pcts: { 5: "120" } }])).toMatch(/хувь буруу/u);
  });

  it("②-ын тойм мөр", () => {
    expect(itemsSummary([])).toBe("Бараа сонгоогүй");
    expect(itemsSummary(draft().items)).toBe(
      "2 бараа сонгосон · хямдрал 20–30%",
    );
    expect(itemsSummary([{ productId: P1, pcts: {} }])).toBe(
      "1 бараа сонгосон · хувьгүй",
    );
  });
});

describe("огноо", () => {
  it("өдрийн харьяалахын нөхцөл: нэг, дөрөв, ес → -ний", () => {
    expect([1, 4, 9, 11, 14, 19, 21, 24, 29, 31].map(dayGenitive)).toEqual([
      "1-ний",
      "4-ний",
      "9-ний",
      "11-ний",
      "14-ний",
      "19-ний",
      "21-ний",
      "24-ний",
      "29-ний",
      "31-ний",
    ]);
    expect([2, 3, 5, 10, 20, 23, 30].map(dayGenitive)).toEqual([
      "2-ны",
      "3-ны",
      "5-ны",
      "10-ны",
      "20-ны",
      "23-ны",
      "30-ны",
    ]);
  });

  it("хугацааны өгүүлбэр (§5.1)", () => {
    expect(periodSentence("2026-11-23", "2026-11-30")).toBe(
      "11-р сарын 23-ны 00:00-оос 11-р сарын 30-ны 23:59 хүртэл — 8 хоног (Улаанбаатарын цагаар)",
    );
    expect(daysInclusive("2026-12-28", "2027-01-03")).toBe(7);
    expect(periodSentence("2026-11-23", "")).toBeNull();
    expect(periodSentence("2026-11-30", "2026-11-23")).toBeNull();
  });

  it("гарагтай өдөр", () => {
    // 2026-11-23 бол Даваа гараг.
    expect(dayWithWeekday("2026-11-23")).toBe("11/23 (Даваа)");
    expect(dayWithWeekday("2026-11-29")).toBe("11/29 (Ням)");
  });
});

describe("studioTimeline (§5.5)", () => {
  it("ноорог: одоо → эхлэх → дуусах; хувь, шүүлтүүр, тэмдэг", () => {
    const t = studioTimeline({
      draft: draft(),
      phase: "draft",
      bannerReady: false,
    });
    expect(t.map((n) => n.key)).toEqual(["now", "start", "end"]);
    expect(t[0].current).toBe(true);
    expect(t[0].lines[0]).toMatch(/Ноорог/);
    expect(t[1].when).toBe("11/23 (Даваа) 00:00");
    expect(t[1].lines).toEqual([
      "1 барааны үнэ 20–30% буурна.",
      "Хувьгүй 1 бараа үнээрээ үлдэж, жагсаалтад орно.",
      "Каталогт «Black Friday» шүүлтүүр, барааны карт дээр «Black Friday» тэмдэг гарна.",
      "Сайтын дээд талд «Black Friday» гүйдэг зурвас гарна.",
    ]);
    expect(t[2].when).toBe("11/30 (Даваа) 23:59");
    expect(t[2].lines).toEqual([
      "Үнэ буцна; зурвас, шүүлтүүр, тэмдэг алга болно.",
    ]);
  });

  it("баннер бэлэн бол эхлэх, дуусах хоёуланд мөр нэмэгдэнэ", () => {
    const t = studioTimeline({
      draft: draft(),
      phase: "scheduled",
      bannerReady: true,
    });
    expect(t[1].lines).toContain("Нүүр хуудасны баннер солигдоно.");
    expect(t[2].lines).toContain("Нүүр хуудасны баннер өмнөх рүүгээ буцна.");
  });

  it("дуусахад гарах баннерыг нэрлэнэ; зураг эхлэх зангилаанд", () => {
    const named = studioTimeline({
      draft: draft(),
      phase: "draft",
      bannerReady: true,
      bannerThumb: "/x.webp",
      bannerAfter: "«Halloween» баннер",
    });
    expect(named[1].image).toBe("/x.webp");
    expect(named[2].lines).toContain("Нүүр хуудсанд «Halloween» баннер гарна.");
    const fallback = studioTimeline({
      draft: draft(),
      phase: "draft",
      bannerReady: true,
      bannerAfter: null,
    });
    expect(fallback[2].lines).toContain("Нүүр хуудсанд үндсэн баннер гарна.");
    const none = studioTimeline({
      draft: draft(),
      phase: "draft",
      bannerReady: false,
      bannerThumb: "/x.webp",
    });
    expect(none[1].image).toBeNull();
  });

  it("хувьгүй «сонголт» арга хэмжээ: үнэ өөрчлөгдөхгүй, тэмдэггүй", () => {
    const d = draft({ badgeLabel: "", items: [{ productId: P1, pcts: {} }] });
    const t = studioTimeline({ draft: d, phase: null, bannerReady: false });
    expect(t[1].lines).toEqual([
      "1 бараа арга хэмжээний жагсаалтад орно — үнэ өөрчлөгдөхгүй.",
      "Каталогт «Black Friday» шүүлтүүр гарна.",
      "Сайтын дээд талд «Black Friday» гүйдэг зурвас гарна.",
    ]);
    expect(t[2].lines).toEqual(["Зурвас, шүүлтүүр алга болно."]);
  });

  it("тэмдэг хоосон, хувьтай → өгөгдмөл «Хямдрал»", () => {
    const t = studioTimeline({
      draft: draft({ badgeLabel: "" }),
      phase: "draft",
      bannerReady: false,
    });
    expect(t[1].lines.join(" ")).toMatch(/«Хямдрал» тэмдэг/);
  });

  it("явж буй: «одоо» эхлэх ба дуусахын хооронд; дууссан: төгсгөлд", () => {
    const live = studioTimeline({
      draft: draft(),
      phase: "live",
      bannerReady: false,
    });
    expect(live.map((n) => n.key)).toEqual(["start", "now", "end"]);
    expect(live.filter((n) => n.current)).toHaveLength(1);
    const ended = studioTimeline({
      draft: draft(),
      phase: "ended",
      bannerReady: false,
    });
    expect(ended.map((n) => n.key)).toEqual(["start", "end", "now"]);
  });

  it("өдрийн дундуур зогсоосон бол жинхэнэ цаг; хугацаандаа дууссан бол 23:59", () => {
    const stopped = studioTimeline({
      draft: draft(),
      phase: "ended",
      bannerReady: false,
      // 11/30 14:05 УБ.
      endsAt: "2026-11-30T06:05:00.000Z",
    });
    expect(stopped[1].when).toBe("11/30 (Даваа) 14:05 — зогсоосон");
    const natural = studioTimeline({
      draft: draft(),
      phase: "ended",
      bannerReady: false,
      endsAt: ROW.endsAt,
    });
    expect(natural[1].when).toBe("11/30 (Даваа) 23:59");
  });

  it("огноо сонгоогүй үед унахгүй", () => {
    const t = studioTimeline({
      draft: draft({ startsOn: "", endsOn: "" }),
      phase: null,
      bannerReady: false,
    });
    expect(t[1].when).toBe("Эхлэх өдөр");
    expect(t[2].when).toBe("Дуусах өдөр");
  });
});

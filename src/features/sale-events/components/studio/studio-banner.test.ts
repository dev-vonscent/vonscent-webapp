import { describe, expect, it } from "vitest";
import { HERO_EVENT_PRIORITY } from "@/lib/constants";
import { heroInputSchema } from "@/lib/validators/hero";
import type { HeroAdminRow } from "@/features/heroes/types";
import {
  bannerPayload,
  bannerSummary,
  effectiveCanvas,
  initialBannerState,
  staleBannerDates,
  syncBannerCopy,
  type BannerState,
} from "./studio-banner";
import { studioChecklist } from "./studio-checklist";
import { emptyDraft, type StudioDraft } from "./studio-model";

const EVENT_ID = "11111111-1111-4111-8111-111111111111";
const IMG = "https://x.supabase.co/storage/v1/object/public/hero/g/d";

const event = (over: Partial<StudioDraft> = {}): StudioDraft => ({
  ...emptyDraft(),
  name: "Black Friday",
  slug: "black-friday",
  startsOn: "2026-11-23",
  endsOn: "2026-11-30",
  items: [{ productId: "p", pcts: { 5: "20", 10: "30" } }],
  ...over,
});

const row = (over: Partial<HeroAdminRow> = {}): HeroAdminRow => ({
  id: "22222222-2222-4222-8222-222222222222",
  name: "Black Friday",
  saleEventId: EVENT_ID,
  startsAt: null,
  endsAt: null,
  priority: 10,
  isActive: true,
  eyebrow: "BF",
  title: "Гарчиг",
  description: "",
  mobileDescription: null,
  primaryLabel: "Үзэх",
  primaryTarget: { type: "event", slug: "black-friday" },
  secondaryLabel: null,
  secondaryTarget: null,
  desktopImage: { base: IMG, widths: [1600], height1600: 571 },
  mobileImage: { src: `${IMG}-m.webp`, width: 1600, height: 1200 },
  imageAlt: "",
  dark: false,
  updatedAt: "2026-11-01T00:00:00Z",
  season: null,
  seasonStartMd: null,
  productIds: [],
  ...over,
});

const fresh = (): BannerState =>
  initialBannerState({ row: null, newGroupId: "g" });

describe("effectiveCanvas", () => {
  it("эхлээгүй бол арга хэмжээнээс бэлэн текст (§6.2)", () => {
    const c = effectiveCanvas(fresh(), event());
    expect(c.title).toBe("Black Friday");
    expect(c.description).toContain("30% хүртэл");
    expect(c.primaryTarget).toEqual({ type: "event", slug: "black-friday" });
    expect(c.desktopImage).toBeNull();
  });
});

describe("bannerPayload", () => {
  it("эхлээгүй / мөргүй «хэрэггүй» бол юу ч явуулахгүй", () => {
    const args = { event: event(), eventId: EVENT_ID, knownSlugs: [] };
    expect(bannerPayload({ ...args, state: fresh() })).toBeNull();
    const skipped = { ...fresh(), draft: effectiveCanvas(fresh(), event()), skip: true };
    expect(bannerPayload({ ...args, state: skipped })).toBeNull();
  });

  it("зураггүй бол идэвхгүй ноорог; схемд хүчинтэй", () => {
    const s = { ...fresh(), draft: effectiveCanvas(fresh(), event()) };
    const p = bannerPayload({ state: s, event: event(), eventId: EVENT_ID, knownSlugs: [] });
    expect(p).toMatchObject({
      saleEventId: EVENT_ID,
      priority: HERO_EVENT_PRIORITY,
      startsOn: null,
      isActive: false,
      imageAlt: "Black Friday — нүүрний баннер",
    });
    expect(heroInputSchema.safeParse(p).success).toBe(true);
  });

  it("бүрэн бол идэвхтэй; «хэрэггүй» бол идэвхгүй", () => {
    const s = initialBannerState({ row: row(), newGroupId: "g" });
    const args = { event: event(), eventId: EVENT_ID, knownSlugs: [] };
    expect(bannerPayload({ ...args, state: s })?.isActive).toBe(true);
    expect(bannerPayload({ ...args, state: { ...s, skip: true } })?.isActive).toBe(false);
  });

  it("мөрийн product_ids-ийг хадгалах бүрт буцааж явуулна (Zod-ын [] дарахгүй)", () => {
    const ids = ["11111111-1111-4111-8111-111111111111"];
    const s = initialBannerState({ row: row({ productIds: ids }), newGroupId: "g" });
    const p = bannerPayload({ state: s, event: event(), eventId: EVENT_ID, knownSlugs: [] });
    expect(p?.productIds).toEqual(ids);
    expect(heroInputSchema.parse(p).productIds).toEqual(ids);
  });

  it("холбоос өөрчлөгдөхөд энэ арга хэмжээ рүү заасан товч дагана (D5)", () => {
    const s = initialBannerState({
      row: row({
        secondaryLabel: "Бүгд",
        secondaryTarget: { type: "event", slug: "other" },
      }),
      newGroupId: "g",
    });
    const p = bannerPayload({
      state: s,
      event: event({ slug: "bf-2026" }),
      eventId: EVENT_ID,
      knownSlugs: ["black-friday"],
    });
    expect(p?.primaryTarget).toEqual({ type: "event", slug: "bf-2026" });
    expect(p?.secondaryTarget).toEqual({ type: "event", slug: "other" });
  });
});

describe("initialBannerState", () => {
  it("хуулахад шинэ мөр, шинэ хавтас, товч шинэ арга хэмжээ рүү", () => {
    const s = initialBannerState({
      row: row(),
      newGroupId: "new-g",
      copy: { fromSlug: "black-friday", toSlug: "black-friday-2027" },
    });
    expect(s.id).toBeNull();
    expect(s.groupId).toBe("new-g");
    expect(s.draft?.primaryTarget).toEqual({ type: "event", slug: "black-friday-2027" });
  });

  it("бүрэн атлаа идэвхгүй мөр = «хэрэггүй»; дутуу идэвхгүй нь хэрэггүй биш", () => {
    expect(initialBannerState({ row: row({ isActive: false }), newGroupId: "g" }).skip).toBe(true);
    expect(
      initialBannerState({ row: row({ isActive: false, mobileImage: null }), newGroupId: "g" }).skip,
    ).toBe(false);
  });
});

describe("checklist + баннер", () => {
  const base = { draft: event(), today: "2026-11-15", bannerEnabled: true };
  it("утасны зураг дутуу → улбар", () => {
    const s = initialBannerState({ row: row({ mobileImage: null }), newGroupId: "g" });
    const item = studioChecklist({ ...base, banner: bannerSummary(s) }).find(
      (i) => i.step === "banner",
    );
    expect(item).toMatchObject({ level: "warn" });
    expect(item?.text).toContain("утасны зураг");
  });
  it("«хэрэггүй» → ✓ мэдээлэл; хадгалалтын алдаа → улбар", () => {
    const items = studioChecklist({
      ...base,
      banner: null,
      bannerSkipped: true,
      bannerError: "Хадгалж чадсангүй.",
    }).filter((i) => i.step === "banner");
    expect(items.map((i) => i.level)).toEqual(["warn", "ok"]);
  });
});

describe("баннерын текст арга хэмжээг дагах", () => {
  const prev = event();
  const base = effectiveCanvas(
    { id: null, groupId: "g", draft: null, skip: false, productIds: [] },
    prev,
  );

  it("хөндөөгүй бэлэн текст огноо, хувийг дагана", () => {
    const next = event({
      endsOn: "2026-12-02",
      items: [{ productId: "p", pcts: { 5: "40" } }],
    });
    const d = syncBannerCopy(base, prev, next);
    expect(d.eyebrow).toBe("Black Friday · 11/23–12/2");
    expect(d.description).toBe("Сонгосон үнэртнүүд 40% хүртэл хямдарлаа. 12/2 хүртэл.");
    expect(d.mobileDescription).toBe("40% хүртэл хямдрал");
  });

  it("админы бичсэн текстийг хөндөхгүй", () => {
    const own = { ...base, eyebrow: "Зөвхөн энэ 7 хоног" };
    const d = syncBannerCopy(own, prev, event({ endsOn: "2026-12-02" }));
    expect(d.eyebrow).toBe("Зөвхөн энэ 7 хоног");
  });

  it("өөрчлөлтгүй бол ижил объект", () => {
    expect(syncBannerCopy(base, prev, event())).toBe(base);
  });

  it("хугацаатай таарахгүй огноог олно", () => {
    const d = { ...base, eyebrow: "Black Friday · 11/23–11/24", description: "" };
    expect(staleBannerDates(d, prev)).toEqual(["11/24"]);
    expect(staleBannerDates(base, prev)).toEqual([]);
    expect(staleBannerDates({ ...base, title: "1/0 биш, 13/5 ч биш" }, prev)).toEqual([]);
  });

  it("checklist-д анхааруулга", () => {
    const items = studioChecklist({
      draft: prev,
      today: "2026-11-15",
      bannerEnabled: true,
      banner: bannerSummary({
        id: "x",
        groupId: "g",
        draft: base,
        skip: false,
        productIds: [],
      }),
      bannerStaleDates: ["11/24"],
    });
    expect(
      items.find((i) => i.step === "banner" && i.text.includes("11/24"))?.level,
    ).toBe("warn");
  });
});

import { describe, expect, it } from "vitest";
import { saleEventInputSchema } from "@/lib/validators/sale-event";
import {
  bundleIssue,
  bundleLock,
  bundlePctLowMessage,
  bundleSizePreview,
  type SaleEventBundleOption,
} from "./bundles";
import {
  bundleChecklistState,
  bundlesStepBlock,
} from "./components/studio/studio-bundles";
import { draftToInput, emptyDraft } from "./components/studio/studio-model";

const option = (
  over: Partial<SaleEventBundleOption> = {},
): SaleEventBundleOption => ({
  id: "c1",
  name: "Өвлийн багц",
  status: "available",
  image: null,
  basePcts: { 2: 5, 5: 5, 10: 5, 20: 15 },
  memberSums: { 2: 20000, 5: 50000, 10: 100000, 20: 180000 },
  events: [],
  ...over,
});

const NOW = Date.parse("2026-11-20T00:00:00Z");
const ev = (o: Partial<SaleEventBundleOption["events"][number]>) => ({
  eventId: "e-other",
  name: "Black Friday",
  isActive: true,
  startsAt: "2026-11-27T16:00:00Z",
  endsAt: "2026-11-30T16:00:00Z",
  ...o,
});

describe("bundleLock — 16.3 (барааны дүрэмтэй ижил)", () => {
  it("хугацаа давхцсан нийтэлсэн event → түгжинэ", () => {
    const r = bundleLock(option({ events: [ev({})] }), {
      eventId: null,
      startsAt: "2026-11-29T16:00:00Z",
      endsAt: "2026-12-02T16:00:00Z",
      now: NOW,
    });
    expect(r.locked?.name).toBe("Black Friday");
  });

  it("хугацаа давхцаагүй нийтэлсэн event → түгжихгүй", () => {
    const r = bundleLock(option({ events: [ev({})] }), {
      eventId: null,
      startsAt: "2026-12-10T16:00:00Z",
      endsAt: "2026-12-12T16:00:00Z",
      now: NOW,
    });
    expect(r.locked).toBeNull();
  });

  it("ноорог түгжихгүй — «ноорог: <нэр>» мэдээлэл", () => {
    const r = bundleLock(
      option({ events: [ev({ isActive: false, name: "Цагаан сар" })] }),
      { eventId: null, startsAt: null, endsAt: null, now: NOW },
    );
    expect(r).toEqual({ locked: null, drafts: ["Цагаан сар"] });
  });

  it("огноо сонгоогүй: дуусаагүй нийтэлсэн event түгжинэ, дууссан нь үгүй", () => {
    const ctx = { eventId: null, startsAt: null, endsAt: null, now: NOW };
    expect(bundleLock(option({ events: [ev({})] }), ctx).locked).not.toBeNull();
    expect(
      bundleLock(
        option({ events: [ev({ endsAt: "2026-11-10T16:00:00Z" })] }),
        ctx,
      ).locked,
    ).toBeNull();
  });

  it("өөрийн event-ийг тооцохгүй", () => {
    const r = bundleLock(option({ events: [ev({ eventId: "me" })] }), {
      eventId: "me",
      startsAt: null,
      endsAt: null,
      now: NOW,
    });
    expect(r.locked).toBeNull();
  });
});

describe("bundleIssue — 16.5 ба «одоогийн хувиас их»", () => {
  it("4 хэмжээ бүгд хоосон → хадгалахгүй", () => {
    expect(
      bundleIssue({ collectionId: "c1", pcts: { 2: "", 5: " " } }, option()),
    ).toMatch(/Дор хаяж нэг хэмжээнд/);
  });
  it("суурь 15% / event 10% → одоогийн хувийг дурдана", () => {
    expect(
      bundleIssue({ collectionId: "c1", pcts: { 20: "10" } }, option()),
    ).toBe("Одоогийн хувиас их байх ёстой (20ml-д 15%)");
  });
  it("тэнцүү (5% = 5%) ч хүчингүй", () => {
    expect(
      bundleIssue({ collectionId: "c1", pcts: { 10: "5" } }, option()),
    ).toMatch(/10ml-д 5%/);
  });
  it("буруу тоо", () => {
    expect(
      bundleIssue({ collectionId: "c1", pcts: { 10: "12.5" } }, option()),
    ).toMatch(/бүхэл тоо/);
  });
  it("хүчинтэй", () => {
    expect(
      bundleIssue({ collectionId: "c1", pcts: { 10: "10" } }, option()),
    ).toBeNull();
  });
});

describe("bundlePctLowMessage — route-ийн монгол мессеж", () => {
  it("суурь 15%, event 10% → мессеж", () => {
    expect(bundlePctLowMessage("Өвлийн багц", { 20: 10 }, { 20: 15 })).toBe(
      "«Өвлийн багц» багцын хувь одоогийнхоос их байх ёстой — одоо 20ml-д 15% хямдралтай.",
    );
  });
  it("бүгд их бол null", () => {
    expect(
      bundlePctLowMessage("X", { 10: 10, 20: 20 }, { 10: 5, 20: 15 }),
    ).toBeNull();
  });
});

describe("bundleSizePreview — студийн үнэ", () => {
  it("100,000₮, одоо 5% (95,000) → Black Friday 10% = 90,000", () => {
    expect(bundleSizePreview(option(), 10, "10", 100)).toEqual({
      memberSum: 100000,
      current: 95000,
      next: 90000,
    });
  });
  it("бага хувь бичсэн ч greatest — үнэтэй болохгүй (85,000 → 85,000)", () => {
    const o = option({ basePcts: { 10: 15 } });
    expect(bundleSizePreview(o, 10, "10", 100)?.next).toBe(85000);
  });
  it("хэмжээ байхгүй бол null", () => {
    expect(
      bundleSizePreview(option({ memberSums: {} }), 10, "10", 100),
    ).toBeNull();
  });
});

describe("студийн checklist / ②-ын хаалга", () => {
  it("асуудалгүй бол хаалгагүй", () => {
    const s = bundleChecklistState(
      {
        ...emptyDraft(),
        collections: [{ collectionId: "c1", pcts: { 10: "10" } }],
      },
      [option()],
      { eventId: null, now: NOW },
    );
    expect(s).toEqual({ count: 1, issues: [], locked: [] });
    expect(bundlesStepBlock(s)).toBeNull();
  });
  it("хувьгүй багц → хаалга", () => {
    const s = bundleChecklistState(
      { ...emptyDraft(), collections: [{ collectionId: "c1", pcts: {} }] },
      [option()],
      { eventId: null, now: NOW },
    );
    expect(bundlesStepBlock(s)).toMatch(/«Өвлийн багц» багц: Дор хаяж/);
  });
});

describe("draftToInput + Zod — туг", () => {
  const d = {
    ...emptyDraft(),
    name: "Black Friday",
    slug: "black-friday",
    startsOn: "2026-11-28",
    endsOn: "2026-11-30",
    collections: [
      {
        collectionId: "6f1c2b9e-4b2a-4e0f-9a51-3c2d1e0f9a11",
        pcts: { 10: "10", 2: "" },
      },
    ],
  };

  it("туг хаалттай → `collections` түлхүүр огт явахгүй (санд хөндөгдөхгүй)", () => {
    const input = draftToInput(d, false) as Record<string, unknown>;
    expect("collections" in input).toBe(false);
  });

  it("туг нээлттэй → хоосон хэмжээг хасаж тоо болгоно", () => {
    const input = draftToInput(d, false, { bundles: true }) as {
      collections: unknown;
    };
    expect(input.collections).toEqual([
      {
        collectionId: "6f1c2b9e-4b2a-4e0f-9a51-3c2d1e0f9a11",
        pcts: { 10: 10 },
      },
    ]);
    expect(saleEventInputSchema.safeParse(input).success).toBe(true);
  });

  it("16.5: 4 хэмжээ бүгд хувьгүй багц Zod-оор татгалзана (ноорогт ч)", () => {
    const input = draftToInput(
      {
        ...d,
        collections: [
          { collectionId: d.collections[0].collectionId, pcts: {} },
        ],
      },
      false,
      { bundles: true },
    );
    const r = saleEventInputSchema.safeParse(input);
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toMatch(/багц бүр дор хаяж/);
  });

  it("зөвхөн багцтай арга хэмжээг нийтэлж болно", () => {
    const input = draftToInput(d, true, { bundles: true });
    expect(saleEventInputSchema.safeParse(input).success).toBe(true);
  });
});

describe("merge горим (0191) — чимээгүй хасалт байхгүй", () => {
  const LN = "6f1c2b9e-4b2a-4e0f-9a51-3c2d1e0f9a11";
  const OFFICE = "7a2c3d4e-5f60-4a1b-8c9d-0e1f2a3b4c5d";
  const P1 = "8b3d4e5f-6071-4b2c-9d0e-1f2a3b4c5d6e";
  const base = {
    ...emptyDraft(),
    name: "Black Friday",
    slug: "black-friday",
    startsOn: "2026-11-28",
    endsOn: "2026-11-30",
    items: [{ productId: P1, pcts: { 10: "20" } }],
    collections: [{ collectionId: LN, pcts: { 10: "10" } }],
  };

  it("админ өөр багц нэмэхэд хасалт хоосон — LADIES NIGHT илгээгдээгүй ч устахгүй", () => {
    const next = {
      ...base,
      collections: [
        ...base.collections,
        { collectionId: OFFICE, pcts: { 10: "12" } },
      ],
    };
    const input = draftToInput(next, true, { bundles: true, base }) as {
      removedCollectionIds: string[];
      removedProductIds: string[];
    };
    expect(input.removedCollectionIds).toEqual([]);
    expect(input.removedProductIds).toEqual([]);
    expect(saleEventInputSchema.safeParse(input).success).toBe(true);
  });

  it("хуучин snapshot (LN-гүй) -оос хадгалахад LN хасалтад орохгүй", () => {
    const stale = { ...base, collections: [] };
    const next = {
      ...stale,
      collections: [{ collectionId: OFFICE, pcts: { 10: "12" } }],
    };
    const input = draftToInput(next, true, {
      bundles: true,
      base: stale,
    }) as { removedCollectionIds: string[] };
    expect(input.removedCollectionIds).toEqual([]);
  });

  it("админ өөрөө хассан багц / бараа л хасалтад орно", () => {
    const next = { ...base, items: [], collections: [] };
    const input = draftToInput(next, true, { bundles: true, base }) as {
      removedCollectionIds: string[];
      removedProductIds: string[];
    };
    expect(input.removedCollectionIds).toEqual([LN]);
    expect(input.removedProductIds).toEqual([P1]);
  });

  it("туг хаалттай → багцын хасалт ч явахгүй", () => {
    const input = draftToInput(base, true, { base }) as Record<string, unknown>;
    expect("removedCollectionIds" in input).toBe(false);
    expect(input.removedProductIds).toEqual([]);
  });

  it("шинэ арга хэмжээ (base-гүй) → хуучин бүрэн солих зан төлөв", () => {
    const input = draftToInput(base, false, { bundles: true }) as Record<
      string,
      unknown
    >;
    expect("removedProductIds" in input).toBe(false);
  });
});

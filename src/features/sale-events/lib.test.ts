import { describe, expect, it } from "vitest";
import {
  eventBadgeMap,
  formatCountdown,
  formatEventPeriod,
  overlapConflicts,
  overlapMessage,
  saleEventPhase,
} from "./lib";
import type { LiveSaleEvent } from "./types";

// 2026-11-23 00:00 УБ = 2026-11-22T16:00Z; дуусах өдөр 11/30 → exclusive 12/01 00:00.
const START = "2026-11-22T16:00:00.000Z";
const END = "2026-11-30T16:00:00.000Z";

describe("saleEventPhase", () => {
  const e = { isActive: true, startsAt: START, endsAt: END };
  it("ноорог / товлосон / явж байна / дууссан", () => {
    expect(saleEventPhase({ ...e, isActive: false }, Date.parse(START))).toBe(
      "draft",
    );
    expect(saleEventPhase(e, Date.parse(START) - 1)).toBe("scheduled");
    expect(saleEventPhase(e, Date.parse(START))).toBe("live");
    expect(saleEventPhase(e, Date.parse(END) - 1)).toBe("live");
    // ends_at exclusive — яг тэр мөчөөс дууссан.
    expect(saleEventPhase(e, Date.parse(END))).toBe("ended");
  });
});

describe("formatCountdown", () => {
  it("өдөр/цаг/минут", () => {
    expect(formatCountdown((2 * 24 + 4) * 3_600_000)).toBe("2 өдөр 4 цаг");
    expect(formatCountdown(2 * 24 * 3_600_000)).toBe("2 өдөр");
    expect(formatCountdown(3 * 3_600_000 + 12 * 60_000)).toBe("3 цаг 12 мин");
    expect(formatCountdown(45 * 60_000)).toBe("45 мин");
    // Минутын хэсэг дээш — «0 мин» гэж хэзээ ч гарахгүй.
    expect(formatCountdown(10_000)).toBe("1 мин");
  });
  it("дууссан бол null", () => {
    expect(formatCountdown(0)).toBeNull();
    expect(formatCountdown(-5)).toBeNull();
  });
});

describe("formatEventPeriod", () => {
  it("УБ өдрөөр, дуусах өдөр нь exclusive хилийн өмнөх өдөр", () => {
    expect(formatEventPeriod(START, END)).toBe("2026.11.23–11.30");
  });
  it("он дамжвал хоёуланд нь он", () => {
    expect(
      formatEventPeriod("2026-12-24T16:00:00Z", "2027-01-02T16:00:00Z"),
    ).toBe("2026.12.25–2027.01.02");
  });
});

describe("eventBadgeMap", () => {
  const ev = (patch: Partial<LiveSaleEvent>): LiveSaleEvent => ({
    slug: "bf",
    name: "Black Friday",
    badgeLabel: "Black Friday",
    headline: null,
    description: null,
    startsAt: START,
    endsAt: END,
    showCountdown: true,
    productIds: ["a", "b"],
    ...patch,
  });
  it("badge_label-тай арга хэмжээний гишүүд", () => {
    expect(eventBadgeMap([ev({})])).toEqual({
      a: "Black Friday",
      b: "Black Friday",
    });
  });
  it("тэмдэггүй арга хэмжээ → map-д орохгүй (карт «Хямдрал»-аа харуулна)", () => {
    expect(eventBadgeMap([ev({ badgeLabel: null })])).toEqual({});
    expect(eventBadgeMap([ev({ badgeLabel: "  " })])).toEqual({});
  });
});

describe("overlap", () => {
  const detail = JSON.stringify([
    {
      productId: "p1",
      product: "Layton",
      brand: "PdM",
      event: "Black Friday",
      startsAt: START,
      endsAt: END,
    },
  ]);
  it("detail → жагсаалт; буруу утга → []", () => {
    expect(overlapConflicts(detail)).toHaveLength(1);
    expect(overlapConflicts("not json")).toEqual([]);
    expect(overlapConflicts(null)).toEqual([]);
    expect(overlapConflicts('[{"x":1}]')).toEqual([]);
  });
  it("арга хэмжээ, хугацаа, барааны нэртэй мессеж", () => {
    expect(overlapMessage(overlapConflicts(detail))).toBe(
      "Энэ 1 бараа «Black Friday»-д (2026.11.23–11.30) аль хэдийн байна: PdM Layton.",
    );
  });
});

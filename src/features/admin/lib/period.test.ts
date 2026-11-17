import { describe, expect, it } from "vitest";
import {
  dayGenitive,
  daysInclusive,
  momentSentence,
  periodSentence,
} from "./period";
import {
  dayEndIso,
  dayLastSecondIso,
  dayStartIso,
  isoEndToDay,
  isoToDay,
} from "./date-range";

describe("periodSentence", () => {
  it("эхлэх, дуусах хоёулаа (task 7-ийн жишээ)", () => {
    expect(periodSentence("2026-11-13", "2026-11-21")).toBe(
      "11-р сарын 13-ны 00:00-оос 11-р сарын 21-ний 23:59 хүртэл — 9 хоног (Улаанбаатарын цагаар)",
    );
  });

  it("нэг өдөр = 1 хоног", () => {
    expect(periodSentence("2026-11-16", "2026-11-16")).toContain("— 1 хоног");
  });

  it("он солигдвол оныг бичнэ", () => {
    expect(periodSentence("2026-12-28", "2027-01-03")).toBe(
      "2026 оны 12-р сарын 28-ны 00:00-оос 2027 оны 1-р сарын 3-ны 23:59 хүртэл — 7 хоног (Улаанбаатарын цагаар)",
    );
  });

  it("зөвхөн дуусах / эхлэх", () => {
    expect(periodSentence("", "2026-11-16")).toBe(
      "11-р сарын 16-ны 23:59 хүртэл (Улаанбаатарын цагаар)",
    );
    expect(periodSentence("", "2026-11-21", { today: "2026-11-17" })).toBe(
      "Өнөөдрөөс 11-р сарын 21-ний 23:59 хүртэл — 5 хоног (Улаанбаатарын цагаар)",
    );
    expect(periodSentence("2026-11-14", "")).toBe(
      "11-р сарын 14-ний 00:00-оос хугацаагүй (Улаанбаатарын цагаар)",
    );
  });

  it("хоосон / буруу дараалал → null", () => {
    expect(periodSentence("", "")).toBeNull();
    expect(periodSentence("2026-11-30", "2026-11-23")).toBeNull();
    expect(periodSentence("", "2026-11-10", { today: "2026-11-17" })).toBeNull();
  });

  it("тайлбар нь хадгалах дүрэмтэй (dayStartIso / dayEndIso) таарна", () => {
    // 16 гэж сонговол 16-ны 00:00 УБ-аас 17-ны 00:00 УБ (exclusive) хүртэл.
    expect(dayStartIso("2026-11-16")).toBe("2026-11-16T00:00:00+08:00");
    expect(dayEndIso("2026-11-16")).toBe("2026-11-16T16:00:00.000Z");
    expect(isoToDay(dayStartIso("2026-11-16"))).toBe("2026-11-16");
    expect(isoEndToDay(dayEndIso("2026-11-16"))).toBe("2026-11-16");
    // Купон (inclusive хил): 16-ны 23:59:59 УБ.
    expect(dayLastSecondIso("2026-11-16")).toBe("2026-11-16T15:59:59.000Z");
    expect(isoEndToDay(dayLastSecondIso("2026-11-16"))).toBe("2026-11-16");
  });
});

describe("helpers", () => {
  it("эгшиг зохицол, хоног", () => {
    expect([1, 4, 9, 10, 21, 23].map(dayGenitive)).toEqual([
      "1-ний",
      "4-ний",
      "9-ний",
      "10-ны",
      "21-ний",
      "23-ны",
    ]);
    expect(daysInclusive("2026-12-28", "2027-01-03")).toBe(7);
  });

  it("нэг мөч", () => {
    expect(momentSentence("2026-11-21", "14:00")).toBe(
      "11-р сарын 21-ний 14:00-д (Улаанбаатарын цагаар)",
    );
    expect(momentSentence("", "14:00")).toBeNull();
  });
});

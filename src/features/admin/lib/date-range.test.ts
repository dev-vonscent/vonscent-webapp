import { describe, expect, it } from "vitest";
import {
  addDaysKey,
  activePreset,
  dateKeyOf,
  endOfDayLocal,
  monthGrid,
  startOfDayLocal,
  timeOf,
  DATE_PRESETS,
} from "./date-range";

describe("addDaysKey", () => {
  it("crosses a month boundary", () => {
    expect(addDaysKey("2026-08-29", 5)).toBe("2026-09-03");
  });
  it("crosses a year boundary backwards", () => {
    expect(addDaysKey("2026-01-02", -5)).toBe("2025-12-28");
  });
  it("handles a leap day", () => {
    expect(addDaysKey("2028-02-28", 1)).toBe("2028-02-29");
  });
});

describe("day bounds", () => {
  it("ends the day at 23:59, not the next midnight", () => {
    // The query uses `lte`; T00:00 of the next day would swallow its first
    // orders into the previous day's range.
    expect(endOfDayLocal("2026-08-29")).toBe("2026-08-29T23:59");
    expect(startOfDayLocal("2026-08-29")).toBe("2026-08-29T00:00");
  });
});

describe("presets", () => {
  const today = "2026-08-29";

  it("«Өнөөдөр» covers exactly one day", () => {
    const r = DATE_PRESETS.find((p) => p.id === "today")!.range(today)!;
    expect(r).toEqual({ from: "2026-08-29T00:00", to: "2026-08-29T23:59" });
  });

  it("«7 хоног» includes today, so it spans 7 days not 8", () => {
    const r = DATE_PRESETS.find((p) => p.id === "7d")!.range(today)!;
    expect(r.from).toBe("2026-08-23T00:00");
    expect(r.to).toBe("2026-08-29T23:59");
  });

  it("«Бүх хугацаа» clears the range", () => {
    expect(DATE_PRESETS.find((p) => p.id === "all")!.range(today)).toBeNull();
  });
});

describe("activePreset", () => {
  const today = "2026-08-29";
  it("recognises a preset round-tripped through the URL", () => {
    expect(activePreset("2026-08-29T00:00", "2026-08-29T23:59", today)).toBe(
      "today",
    );
  });
  it("calls an empty range «all»", () => {
    expect(activePreset(undefined, undefined, today)).toBe("all");
  });
  it("calls anything else «custom»", () => {
    expect(activePreset("2026-08-01T09:00", "2026-08-04T18:00", today)).toBe(
      "custom",
    );
  });
});

describe("parsing back out of the URL", () => {
  it("splits a datetime-local value", () => {
    expect(dateKeyOf("2026-08-29T14:30")).toBe("2026-08-29");
    expect(timeOf("2026-08-29T14:30", "00:00")).toBe("14:30");
  });
  it("falls back rather than throwing on junk", () => {
    expect(dateKeyOf("nonsense")).toBe("");
    expect(timeOf(undefined, "23:59")).toBe("23:59");
  });
});

describe("monthGrid", () => {
  it("is Monday-first and pads to whole weeks", () => {
    // 2026-08-01 is a Saturday → five leading blanks under Да–Ба.
    const cells = monthGrid(2026, 7);
    expect(cells.length % 7).toBe(0);
    expect(cells.slice(0, 5).every((c) => c === null)).toBe(true);
    expect(cells[5]).toBe("2026-08-01");
  });

  it("covers every day of the month exactly once", () => {
    const days = monthGrid(2026, 1).filter(Boolean); // February 2026
    expect(days).toHaveLength(28);
    expect(new Set(days).size).toBe(28);
  });
});

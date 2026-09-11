import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime } from "./format";

/**
 * These two are pinned by test because the bug they fix was invisible in code
 * review: `mn-MN` renders a month with no year beside it as a ROMAN numeral,
 * so the admin order list read «08 IX 15:34». The assertions below are literal
 * strings on purpose — a locale-data update must not be able to change the
 * shape of a timestamp the operator reads all day.
 */
describe("formatDate / formatDateTime", () => {
  it("writes year.month.day, zero-padded", () => {
    expect(formatDate("2026-09-08T07:34:00Z")).toBe("2026.09.08");
    expect(formatDate("2026-01-02T04:00:00Z")).toBe("2026.01.02");
  });

  it("adds a 24-hour clock time", () => {
    expect(formatDateTime("2026-09-08T07:34:00Z")).toBe("2026.09.08 15:34");
  });

  it("never falls back to a Roman month", () => {
    // The whole point: no numeral other than 0-9 may appear.
    expect(formatDateTime("2026-09-08T07:34:00Z")).toMatch(
      /^\d{4}\.\d{2}\.\d{2} \d{2}:\d{2}$/u,
    );
  });

  it("reads the clock in Ulaanbaatar, not UTC", () => {
    // UTC+8: 16:05 UTC is already the next day in the shop's own timezone.
    expect(formatDateTime("2026-09-08T16:05:00Z")).toBe("2026.09.09 00:05");
    expect(formatDate("2026-09-08T16:05:00Z")).toBe("2026.09.09");
  });

  it("keeps midnight at 00, not 24", () => {
    expect(formatDateTime("2026-09-08T16:00:00Z")).toBe("2026.09.09 00:00");
  });
});

import { describe, expect, it } from "vitest";
import {
  SCHEDULE_TIMES,
  broadcastPhase,
  formatUbDateTime,
  isoToUbParts,
  readPercent,
  ubDateTimeToIso,
} from "./broadcast-lib";

describe("schedule time helpers", () => {
  it("30 минутын 48 сонголт", () => {
    expect(SCHEDULE_TIMES).toHaveLength(48);
    expect(SCHEDULE_TIMES[0]).toBe("00:00");
    expect(SCHEDULE_TIMES[21]).toBe("10:30");
    expect(SCHEDULE_TIMES[47]).toBe("23:30");
  });

  it("УБ-ын цаг ↔ ISO", () => {
    expect(ubDateTimeToIso("2026-10-20", "14:00")).toBe(
      "2026-10-20T06:00:00.000Z",
    );
    // УБ-д шөнө дунд өнгөрсөн ч UTC-д өмнөх өдөр
    expect(ubDateTimeToIso("2026-10-20", "03:30")).toBe(
      "2026-10-19T19:30:00.000Z",
    );
    expect(isoToUbParts("2026-10-19T19:30:00Z")).toEqual({
      day: "2026-10-20",
      time: "03:30",
    });
    expect(isoToUbParts("2026-10-20T06:44:10Z")).toEqual({
      day: "2026-10-20",
      time: "14:30",
    });
  });

  it("formatUbDateTime", () => {
    expect(formatUbDateTime("2026-10-20T06:00:00Z")).toBe("10/20 14:00");
  });
});

describe("broadcastPhase / readPercent", () => {
  it("хэтэрсэн хуваарь", () => {
    expect(broadcastPhase({ status: "scheduled", overdue: true })).toBe(
      "overdue",
    );
    expect(broadcastPhase({ status: "scheduled", overdue: false })).toBe(
      "scheduled",
    );
    expect(broadcastPhase({ status: "sent", overdue: false })).toBe("sent");
  });

  it("уншсан хувь", () => {
    expect(readPercent(0, 0)).toBe(0);
    expect(readPercent(1, 3)).toBe(33);
    expect(readPercent(5, 3)).toBe(100);
  });
});

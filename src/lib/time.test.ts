import { describe, it, expect } from "vitest";
import {
  orderDispatchAt,
  orderEditDeadline,
  isOrderEditable,
  formatDeadline,
} from "./time";

/**
 * All fixtures are written as UTC instants with the matching UB wall-clock in
 * the comment (UB = UTC+8), so the assertions stay readable.
 *
 * Rule under test (client, 2026-08-21): every order dispatches the NEXT day
 * at 11:00 UB; cancel/edit closes at 09:00 UB on the dispatch day.
 */
describe("order dispatch & cut-off rules", () => {
  describe("orderDispatchAt", () => {
    it("dispatches the next day at 11:00 UB for a morning order", () => {
      // placed 2026-07-31 08:00 UB (00:00Z) -> 2026-08-01 11:00 UB = 03:00Z
      const d = orderDispatchAt(new Date("2026-07-31T00:00:00Z"));
      expect(d.toISOString()).toBe("2026-08-01T03:00:00.000Z");
    });

    it("dispatches the next day even for a late-night order", () => {
      // placed 2026-07-31 23:30 UB (15:30Z) -> 2026-08-01 11:00 UB
      const d = orderDispatchAt(new Date("2026-07-31T15:30:00Z"));
      expect(d.toISOString()).toBe("2026-08-01T03:00:00.000Z");
    });

    it("does not use the host timezone", () => {
      // 2026-07-31 23:30Z = 2026-08-01 07:30 UB -> dispatch 2026-08-02 11:00 UB
      const d = orderDispatchAt(new Date("2026-07-31T23:30:00Z"));
      expect(d.toISOString()).toBe("2026-08-02T03:00:00.000Z");
    });
  });

  describe("orderEditDeadline", () => {
    it("is 09:00 UB the next day for a morning order", () => {
      // placed 2026-07-31 08:00 UB -> deadline 2026-08-01 09:00 UB = 01:00Z
      const d = orderEditDeadline(new Date("2026-07-31T00:00:00Z"));
      expect(d.toISOString()).toBe("2026-08-01T01:00:00.000Z");
    });

    it("is 09:00 UB the next day for an afternoon order too", () => {
      // placed 15:00 UB (07:00Z) -> same deadline: next day 09:00 UB
      const d = orderEditDeadline(new Date("2026-07-31T07:00:00Z"));
      expect(d.toISOString()).toBe("2026-08-01T01:00:00.000Z");
    });

    it("rolls across a month boundary", () => {
      // 2026-07-31 23:00 UB (15:00Z) -> deadline 2026-08-01 09:00 UB
      const d = orderEditDeadline(new Date("2026-07-31T15:00:00Z"));
      expect(d.toISOString()).toBe("2026-08-01T01:00:00.000Z");
    });
  });

  describe("isOrderEditable", () => {
    it("allows cancelling before 09:00 UB on the dispatch day", () => {
      const placed = new Date("2026-07-31T07:00:00Z"); // 15:00 UB
      const now = new Date("2026-08-01T00:30:00Z"); // 08:30 UB next day
      expect(isOrderEditable(placed, now)).toBe(true);
    });

    it("blocks cancelling once 09:00 UB has passed", () => {
      const placed = new Date("2026-07-31T07:00:00Z"); // 15:00 UB
      const now = new Date("2026-08-01T01:30:00Z"); // 09:30 UB next day
      expect(isOrderEditable(placed, now)).toBe(false);
    });

    it("treats the deadline instant itself as closed", () => {
      const placed = new Date("2026-07-31T07:00:00Z");
      expect(isOrderEditable(placed, new Date("2026-08-01T01:00:00Z"))).toBe(
        false,
      );
    });

    it("keeps the full evening open for a same-day placed order", () => {
      // placed 10:30 UB — under the old same-day rule this closed instantly;
      // now it stays open until tomorrow 09:00 UB.
      const placed = new Date("2026-07-31T02:30:00Z");
      expect(isOrderEditable(placed, new Date("2026-07-31T14:00:00Z"))).toBe(
        true,
      );
    });
  });

  describe("formatDeadline", () => {
    it("prints the dispatch-day 09:00 label in UB time", () => {
      expect(formatDeadline(new Date("2026-07-31T07:00:00Z"))).toBe(
        "08/01 09:00",
      );
    });
  });
});

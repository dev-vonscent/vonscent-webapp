import { describe, it, expect } from "vitest";
import { shipsToday, orderEditDeadline, isOrderEditable } from "./time";

/**
 * All fixtures are written as UTC instants with the matching UB wall-clock in
 * the comment (UB = UTC+8), so the assertions stay readable.
 */
describe("order cut-off rules", () => {
  describe("shipsToday", () => {
    it("is true before 11:00 UB", () => {
      // 2026-07-31 02:00Z = 10:00 UB
      expect(shipsToday(new Date("2026-07-31T02:00:00Z"))).toBe(true);
    });

    it("is false from 11:00 UB onward", () => {
      // 2026-07-31 03:00Z = 11:00 UB
      expect(shipsToday(new Date("2026-07-31T03:00:00Z"))).toBe(false);
    });

    it("does not use the host timezone", () => {
      // 23:30Z = 07:30 UB next day -> still a same-day order
      expect(shipsToday(new Date("2026-07-31T23:30:00Z"))).toBe(true);
    });
  });

  describe("orderEditDeadline", () => {
    it("uses the same day at 10:00 UB for an early order", () => {
      // placed 08:00 UB -> ships today -> deadline today 10:00 UB = 02:00Z
      const d = orderEditDeadline(new Date("2026-07-31T00:00:00Z"));
      expect(d.toISOString()).toBe("2026-07-31T02:00:00.000Z");
    });

    it("rolls to the next day for an order placed after 11:00 UB", () => {
      // placed 15:00 UB (07:00Z) -> ships tomorrow -> tomorrow 10:00 UB
      const d = orderEditDeadline(new Date("2026-07-31T07:00:00Z"));
      expect(d.toISOString()).toBe("2026-08-01T02:00:00.000Z");
    });

    it("rolls across a month boundary", () => {
      // 2026-07-31 23:00 UB = 15:00Z -> deadline 2026-08-01 10:00 UB
      const d = orderEditDeadline(new Date("2026-07-31T15:00:00Z"));
      expect(d.toISOString()).toBe("2026-08-01T02:00:00.000Z");
    });
  });

  describe("isOrderEditable", () => {
    it("allows cancelling before the deadline", () => {
      const placed = new Date("2026-07-31T07:00:00Z"); // 15:00 UB
      const now = new Date("2026-08-01T01:00:00Z"); // 09:00 UB next day
      expect(isOrderEditable(placed, now)).toBe(true);
    });

    it("blocks cancelling once 10:00 UB has passed", () => {
      const placed = new Date("2026-07-31T07:00:00Z"); // 15:00 UB
      const now = new Date("2026-08-01T02:30:00Z"); // 10:30 UB next day
      expect(isOrderEditable(placed, now)).toBe(false);
    });

    it("treats the deadline instant itself as closed", () => {
      const placed = new Date("2026-07-31T07:00:00Z");
      expect(isOrderEditable(placed, new Date("2026-08-01T02:00:00Z"))).toBe(
        false,
      );
    });

    it("closes immediately for an order placed between 10:00 and 11:00 UB", () => {
      // 10:30 UB ships today, but today's 10:00 edit window already lapsed.
      const placed = new Date("2026-07-31T02:30:00Z");
      expect(isOrderEditable(placed, new Date("2026-07-31T02:35:00Z"))).toBe(
        false,
      );
    });
  });
});

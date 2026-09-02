import { describe, it, expect } from "vitest";
import {
  orderDispatchAt,
  orderEditDeadline,
  isOrderEditable,
  formatDeadline,
  deliveryDayOf,
  earliestDeliveryDay,
  formatDeliveryDay,
  ubToday,
} from "./time";

/**
 * All fixtures are written as UTC instants with the matching UB wall-clock in
 * the comment (UB = UTC+8), so the assertions stay readable.
 *
 * Rule under test (client 2026-08-21, amended by backlog E1 2026-09-02): an
 * order goes out at 11:00 UB on its delivery day and stops being editable at
 * 09:00 UB that same day. Without a stored day the old rule applies — the day
 * after it was placed.
 */
describe("order dispatch & cut-off rules", () => {
  describe("deliveryDayOf", () => {
    it("uses the stored day when the customer picked one", () => {
      expect(
        deliveryDayOf({
          created_at: "2026-07-31T00:00:00Z",
          deliver_on: "2026-08-14",
        }),
      ).toBe("2026-08-14");
    });

    it("falls back to the day after placement for pre-E1 orders", () => {
      // 2026-07-31 08:00 UB -> 2026-08-01
      expect(deliveryDayOf({ created_at: "2026-07-31T00:00:00Z" })).toBe(
        "2026-08-01",
      );
    });

    it("reads the placement day in UB, not the host timezone", () => {
      // 2026-07-31 23:30Z = 2026-08-01 07:30 UB -> delivery 2026-08-02
      expect(deliveryDayOf({ created_at: "2026-07-31T23:30:00Z" })).toBe(
        "2026-08-02",
      );
    });
  });

  describe("orderDispatchAt", () => {
    it("dispatches at 11:00 UB on the chosen day", () => {
      const d = orderDispatchAt({
        created_at: "2026-07-31T00:00:00Z",
        deliver_on: "2026-08-14",
      });
      expect(d.toISOString()).toBe("2026-08-14T03:00:00.000Z");
    });

    it("dispatches the next day for an order without a chosen day", () => {
      // placed 2026-07-31 23:30 UB (15:30Z) -> 2026-08-01 11:00 UB = 03:00Z
      const d = orderDispatchAt({ created_at: "2026-07-31T15:30:00Z" });
      expect(d.toISOString()).toBe("2026-08-01T03:00:00.000Z");
    });
  });

  describe("orderEditDeadline", () => {
    it("is 09:00 UB on the delivery day, however far ahead it is", () => {
      const d = orderEditDeadline({
        created_at: "2026-07-31T00:00:00Z",
        deliver_on: "2026-08-14",
      });
      expect(d.toISOString()).toBe("2026-08-14T01:00:00.000Z");
    });

    it("is 09:00 UB the next day for a pre-E1 order", () => {
      // placed 2026-07-31 08:00 UB -> deadline 2026-08-01 09:00 UB = 01:00Z
      const d = orderEditDeadline({ created_at: "2026-07-31T00:00:00Z" });
      expect(d.toISOString()).toBe("2026-08-01T01:00:00.000Z");
    });
  });

  describe("isOrderEditable", () => {
    it("stays open right up to the deadline", () => {
      const order = { created_at: "2026-07-31T00:00:00Z" };
      expect(isOrderEditable(order, new Date("2026-08-01T00:59:00Z"))).toBe(
        true,
      );
      expect(isOrderEditable(order, new Date("2026-08-01T01:00:00Z"))).toBe(
        false,
      );
    });

    it("keeps a pre-order cancellable for days", () => {
      const order = {
        created_at: "2026-07-31T00:00:00Z",
        deliver_on: "2026-08-14",
      };
      // Long past the old "next day 09:00" deadline, but its own day is far off.
      expect(isOrderEditable(order, new Date("2026-08-05T12:00:00Z"))).toBe(
        true,
      );
      expect(isOrderEditable(order, new Date("2026-08-14T01:00:00Z"))).toBe(
        false,
      );
    });
  });

  describe("formatDeadline", () => {
    it("reads as UB wall-clock on the delivery day", () => {
      expect(
        formatDeadline({
          created_at: "2026-07-31T07:00:00Z",
          deliver_on: "2026-08-14",
        }),
      ).toBe("08/14 09:00");
    });
  });

  describe("formatDeliveryDay", () => {
    const now = new Date("2026-08-01T02:00:00Z"); // 10:00 UB, 2026-08-01

    it("names tomorrow rather than making the reader do the maths", () => {
      expect(formatDeliveryDay(earliestDeliveryDay(now), now)).toBe(
        "Маргааш (08/02, Ням)",
      );
    });

    it("names today", () => {
      expect(formatDeliveryDay(ubToday(now), now)).toBe("Өнөөдөр (08/01, Бямба)");
    });

    it("writes any other day with its weekday", () => {
      expect(formatDeliveryDay("2026-08-14", now)).toBe("08/14, Баасан");
    });
  });
});

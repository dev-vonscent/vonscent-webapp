import { describe, it, expect } from "vitest";
import {
  earliestServableDay,
  projectedDeliveryDay,
  orderDispatchAt,
  orderEditDeadline,
  isOrderEditable,
  formatDeadline,
  formatEditCutoff,
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
 * 00:00 UB that same day — the window shuts as the day begins (client,
 * 2026-09-21). Without a stored day the old rule applies — the day after it
 * was placed.
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
    it("is 00:00 UB on the delivery day, however far ahead it is", () => {
      // 2026-08-14 00:00 UB = 2026-08-13 16:00Z
      const d = orderEditDeadline({
        created_at: "2026-07-31T00:00:00Z",
        deliver_on: "2026-08-14",
      });
      expect(d.toISOString()).toBe("2026-08-13T16:00:00.000Z");
    });

    it("is 00:00 UB the next day for a pre-E1 order", () => {
      // placed 2026-07-31 08:00 UB -> deadline 2026-08-01 00:00 UB = 16:00Z
      const d = orderEditDeadline({ created_at: "2026-07-31T00:00:00Z" });
      expect(d.toISOString()).toBe("2026-07-31T16:00:00.000Z");
    });
  });

  describe("isOrderEditable", () => {
    it("stays open right up to the deadline", () => {
      // deliver_on = 2026-08-01, so the window shuts at 2026-07-31 16:00Z.
      const order = { created_at: "2026-07-31T00:00:00Z" };
      expect(isOrderEditable(order, new Date("2026-07-31T15:59:00Z"))).toBe(
        true,
      );
      expect(isOrderEditable(order, new Date("2026-07-31T16:00:00.000Z"))).toBe(
        false,
      );
    });

    it("keeps a pre-order cancellable for days", () => {
      const order = {
        created_at: "2026-07-31T00:00:00Z",
        deliver_on: "2026-08-14",
      };
      // Long past the old "next day" deadline, but its own day is far off.
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
      ).toBe("08/14 00:00");
    });
  });

  describe("formatEditCutoff", () => {
    it("names the last second, the evening before the delivery day", () => {
      expect(formatEditCutoff("2026-09-22")).toBe("09/21 23:59:59");
    });

    it("steps back across a month boundary", () => {
      expect(formatEditCutoff("2026-09-01")).toBe("08/31 23:59:59");
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
      expect(formatDeliveryDay(ubToday(now), now)).toBe(
        "Өнөөдөр (08/01, Бямба)",
      );
    });

    it("writes any other day with its weekday", () => {
      expect(formatDeliveryDay("2026-08-14", now)).toBe("08/14, Баасан");
    });
  });
});

/**
 * Төлбөр хоцорсон захиалгын хүргэх өдөр.
 *
 * Өчигдөр «маргааш» гэж захиалсан (deliver_on = өнөөдөр) захиалгыг өнөөдөр
 * 12:00-д төлөхөд өнөөдрийн 11:00-ийн хүргэлт аль хэдийн гарсан — тэр
 * захиалга бодитоор маргааш хүргэгдэнэ. Дүрмийн эрх нь migration 0069-ийн
 * `mark_order_paid`-д; эдгээр нь хуудсан дээрх урьдчилсан тооцоог барина.
 */
describe("delivery day of a payment that arrives late", () => {
  /** UB (UTC+8) цагаар тэр өдрийн `hour`:`minute` мөч. */
  const ub = (day: string, hour: number, minute = 0) => {
    const [y, m, d] = day.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d, hour - 8, minute));
  };

  describe("earliestServableDay", () => {
    // Цонх 00:00-д хаагддаг болсноос хойш (ORDER_EDIT_CUTOFF_HOUR = 0)
    // өнөөдрийн бэлтгэл шөнө дундаас эхэлдэг тул хамгийн эрт нь үргэлж
    // маргааш — өглөө эрт төлсөн ч өнөөдөр хүргэгдэхгүй.
    it("is always tomorrow, whatever time of day it is", () => {
      expect(earliestServableDay(ub("2026-09-11", 0, 1))).toBe("2026-09-12");
      expect(earliestServableDay(ub("2026-09-11", 7, 30))).toBe("2026-09-12");
      expect(earliestServableDay(ub("2026-09-11", 12))).toBe("2026-09-12");
      expect(earliestServableDay(ub("2026-09-11", 23, 59))).toBe("2026-09-12");
    });
  });

  describe("projectedDeliveryDay", () => {
    it("moves a day that can no longer be served", () => {
      expect(projectedDeliveryDay("2026-09-11", ub("2026-09-11", 12))).toBe(
        "2026-09-12",
      );
    });

    it("leaves a day that is still ahead alone", () => {
      expect(projectedDeliveryDay("2026-09-15", ub("2026-09-11", 12))).toBe(
        "2026-09-15",
      );
      expect(projectedDeliveryDay("2026-09-12", ub("2026-09-11", 8))).toBe(
        "2026-09-12",
      );
    });

    it("never pulls a day earlier", () => {
      expect(projectedDeliveryDay("2026-09-20", ub("2026-09-11", 23))).toBe(
        "2026-09-20",
      );
    });

    it("falls back to the earliest day when none is stored", () => {
      expect(projectedDeliveryDay(null, ub("2026-09-11", 12))).toBe(
        "2026-09-12",
      );
    });
  });
});

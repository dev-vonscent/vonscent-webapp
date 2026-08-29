import { describe, expect, it } from "vitest";
import { stockState, STOCK_STATE_LABEL } from "./stock-state";
import { DEFAULT_LOW_STOCK_ML } from "@/lib/constants";

/**
 * These three words drive what the operator restocks today, and they used to be
 * computed in four places with two different answers. The disagreement is what
 * these tests pin down.
 */
describe("stockState", () => {
  it("calls zero and below sold out", () => {
    expect(stockState(0, 50)).toBe("soldout");
    expect(stockState(-5, 50)).toBe("soldout");
  });

  it("trusts the DB's own sold-out flag even with ml on hand", () => {
    expect(stockState(120, 50, true)).toBe("soldout");
  });

  it("is inclusive at the threshold", () => {
    // Exactly on the limit is already low, or the alert fires one order late.
    expect(stockState(50, 50)).toBe("low");
    expect(stockState(51, 50)).toBe("ok");
  });

  it("never reports a sold-out product as merely low", () => {
    // The reports did exactly this before the rule was shared.
    expect(stockState(0, 50)).not.toBe("low");
  });

  it("labels every state in Mongolian", () => {
    expect(STOCK_STATE_LABEL[stockState(0, 50)]).toBe("Дууссан");
    expect(STOCK_STATE_LABEL[stockState(20, 50)]).toBe("Бага");
    expect(STOCK_STATE_LABEL[stockState(200, 50)]).toBe("Хэвийн");
  });

  it("puts a single 20ml decant's worth of stock under the new default", () => {
    // The point of raising the default from 20 to 50: 20ml left used to read
    // as "Хэвийн" right up until one order emptied the bottle.
    expect(stockState(20, DEFAULT_LOW_STOCK_ML)).toBe("low");
  });
});

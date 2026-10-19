import { describe, expect, it } from "vitest";
import { numAblative } from "./mn-grammar";

describe("numAblative", () => {
  it.each([
    [0, "0-ээс"],
    [1, "1-ээс"],
    [2, "2-оос"],
    [3, "3-аас"],
    [4, "4-өөс"],
    [7, "7-оос"],
    [9, "9-өөс"],
    [10, "10-аас"],
    [12, "12-оос"],
    [20, "20-оос"],
    [40, "40-өөс"],
    [90, "90-өөс"],
    [100, "100-аас"],
    [1000, "1000-аас"],
  ])("%i → %s", (n, out) => {
    expect(numAblative(n)).toBe(out);
  });
});

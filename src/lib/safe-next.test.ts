import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("keeps same-site paths", () => {
    expect(safeNext("/checkout")).toBe("/checkout");
    expect(safeNext("/account/coupons?tab=used")).toBe(
      "/account/coupons?tab=used",
    );
  });

  it("rejects anything that leaves the site", () => {
    expect(safeNext("https://evil.com")).toBe("/");
    expect(safeNext("//evil.com")).toBe("/");
    expect(safeNext("/\\evil.com")).toBe("/");
    expect(safeNext("javascript:alert(1)")).toBe("/");
    expect(safeNext("/\tevil")).toBe("/");
  });

  it("falls back when missing", () => {
    expect(safeNext(null)).toBe("/");
    expect(safeNext("", "/account")).toBe("/account");
  });
});

import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/products/api", () => ({}));
vi.mock("@/features/collections/api", () => ({}));

const { memberLine } = await import("./og-data");

describe("memberLine", () => {
  it("багтвал бүгдийг цэгээр холбоно", () => {
    expect(memberLine(["By the Fireplace", "Hero edp", "Man in Black"])).toBe(
      "By the Fireplace · Hero edp · Man in Black",
    );
  });

  it("багтахгүй үлдсэнийг +N болгоно", () => {
    expect(
      memberLine([
        "Absolu Aventus",
        "Aventus",
        "Green Irish Tweed",
        "Silver Mountain Water",
      ]),
    ).toBe("Absolu Aventus · Aventus · Green Irish Tweed · +1");
  });

  it("эхний нэр урт байсан ч хоосон үлдээхгүй", () => {
    expect(memberLine(["x".repeat(80), "B"])).toBe(`${"x".repeat(80)} · +1`);
  });

  it("гишүүнгүй бол undefined", () => {
    expect(memberLine([])).toBeUndefined();
  });
});

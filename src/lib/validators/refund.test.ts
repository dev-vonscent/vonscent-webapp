import { describe, expect, it } from "vitest";
import { refundAccountSchema } from "./refund";

describe("refundAccountSchema", () => {
  it("normalises spaces and dashes out of the account number", () => {
    const r = refundAccountSchema.parse({
      bank: "Хаан банк",
      accountNumber: "5000 1234-5678",
      holderName: "  Бат-Эрдэнэ ",
    });
    expect(r).toEqual({
      bank: "Хаан банк",
      accountNumber: "500012345678",
      holderName: "Бат-Эрдэнэ",
    });
  });

  it("accepts an MN IBAN", () => {
    expect(
      refundAccountSchema.safeParse({
        bank: "Голомт банк",
        accountNumber: "mn12 0015 0012 3456 7890",
        holderName: "Сараа",
      }).success,
    ).toBe(true);
  });

  it("rejects an unknown bank, a short number and a missing name", () => {
    const r = refundAccountSchema.safeParse({
      bank: "Нэг банк",
      accountNumber: "1234",
      holderName: "",
    });
    expect(r.success).toBe(false);
    const paths = r.error?.issues.map((i) => i.path[0]);
    expect(paths).toEqual(
      expect.arrayContaining(["bank", "accountNumber", "holderName"]),
    );
    expect(r.error?.issues.find((i) => i.path[0] === "bank")?.message).toBe(
      "Банкаа сонгоно уу",
    );
  });
});

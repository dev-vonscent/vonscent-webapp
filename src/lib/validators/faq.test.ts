import { describe, expect, it } from "vitest";
import { faqCreateSchema, faqPatchSchema } from "./faq";

describe("faq validators", () => {
  it("accepts only the three fixed categories", () => {
    const base = { question: "Q?", answer: "A" };
    expect(
      faqCreateSchema.safeParse({ ...base, category: "Хүргэлт" }).success,
    ).toBe(true);
    expect(
      faqCreateSchema.safeParse({ ...base, category: "Бусад" }).success,
    ).toBe(false);
    expect(faqCreateSchema.safeParse({ ...base, category: "" }).success).toBe(
      false,
    );
  });

  it("lets a patch leave the category out, but not blank it", () => {
    expect(faqPatchSchema.safeParse({ answer: "A" }).success).toBe(true);
    expect(faqPatchSchema.safeParse({ category: "" }).success).toBe(false);
  });

  it("keeps a new FAQ out of the chat unless asked", () => {
    const base = { category: "Хүргэлт", question: "Q?", answer: "A" };
    expect(faqCreateSchema.parse(base).chatPinned).toBe(false);
    expect(faqCreateSchema.parse({ ...base, chatPinned: true }).chatPinned).toBe(
      true,
    );
    expect(faqPatchSchema.parse({}).chatPinned).toBeUndefined();
  });
});

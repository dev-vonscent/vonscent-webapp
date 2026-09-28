import { describe, expect, it } from "vitest";
import { noteTranslationsSaveSchema } from "./note-translation";

describe("noteTranslationsSaveSchema", () => {
  it("accepts a named note and trims it", () => {
    const r = noteTranslationsSaveSchema.parse({
      items: [{ mn: " Юзу ", en: "  Yuzu  " }],
    });
    expect(r.items[0]).toEqual({ mn: "Юзу", en: "Yuzu", isAbstract: false });
  });

  it("accepts an abstract note without an English name", () => {
    expect(
      noteTranslationsSaveSchema.safeParse({
        items: [{ mn: "Мускус", isAbstract: true }],
      }).success,
    ).toBe(true);
  });

  it("rejects a note that is neither named nor abstract", () => {
    expect(
      noteTranslationsSaveSchema.safeParse({ items: [{ mn: "Юзу", en: " " }] })
        .success,
    ).toBe(false);
  });
});

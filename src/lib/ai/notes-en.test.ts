import { describe, expect, it } from "vitest";
import { pickNotes, untranslatedNotes, type NoteOverrides } from "./notes-en";

const tiers = (top: string[], heart: string[] = [], base: string[] = []) => ({
  top,
  heart,
  base,
});

describe("pickNotes", () => {
  it("drops notes the table does not know", () => {
    expect(pickNotes(tiers(["Юзу", "Бергамот"]))).toEqual(["Bergamot"]);
  });

  it("uses admin translations for notes the table lacks", () => {
    const overrides: NoteOverrides = new Map([
      ["Юзу", { en: "Yuzu", isAbstract: false }],
    ]);
    expect(pickNotes(tiers(["Юзу", "Бергамот"]), 5, overrides)).toEqual([
      "Yuzu",
      "Bergamot",
    ]);
  });

  it("skips notes the admin marked abstract, even ones the table knows", () => {
    const overrides: NoteOverrides = new Map([
      ["Бергамот", { en: "", isAbstract: true }],
    ]);
    expect(pickNotes(tiers(["Бергамот", "Алим"]), 5, overrides)).toEqual([
      "Apple",
    ]);
  });

  it("still leaves out abstract accords from the table", () => {
    expect(pickNotes(tiers(["Амбер"]))).toEqual([]);
  });
});

describe("untranslatedNotes", () => {
  it("lists notes with no English name, once, in order", () => {
    expect(
      untranslatedNotes(
        tiers(["Юзу", "Бергамот"], ["Пион", " Юзу "], ["Амбер"]),
      ),
    ).toEqual(["Юзу", "Пион"]);
  });

  it("treats admin-filled and abstract-marked notes as done", () => {
    const overrides: NoteOverrides = new Map([
      ["Юзу", { en: "Yuzu", isAbstract: false }],
      ["Пион", { en: "", isAbstract: true }],
    ]);
    expect(untranslatedNotes(tiers(["Юзу", "Пион"]), overrides)).toEqual([]);
  });
});

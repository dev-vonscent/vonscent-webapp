import { describe, it, expect } from "vitest";
import {
  buildCollectionImagePrompt,
  COLLECTION_BASE_PROMPT,
} from "./collection-image-prompt";

const members = [
  { brand: "Creed", name: "Aventus" },
  { brand: "Chanel", name: "Bleu de Chanel" },
  { brand: null, name: "Layton" },
  { brand: "Tom Ford", name: "Ombre Leather" },
];

describe("buildCollectionImagePrompt", () => {
  it("starts with the base prompt", () => {
    const p = buildCollectionImagePrompt({ name: "Gentleman", members });
    expect(p.startsWith(COLLECTION_BASE_PROMPT)).toBe(true);
  });

  it("lists the members in reference order", () => {
    const p = buildCollectionImagePrompt({ name: "Gentleman", members });
    expect(p).toContain("1. Creed — Aventus");
    expect(p).toContain("3. Layton");
    expect(p).toContain("4. Tom Ford — Ombre Leather");
  });

  it("carries the name, gender and description", () => {
    const p = buildCollectionImagePrompt({
      name: "Winter",
      gender: "male",
      description: "Галын дэргэд тухлах шиг дулаахан.",
      members,
    });
    expect(p).toContain("Set name: Winter");
    expect(p).toContain("Gender: male");
    expect(p).toContain("Галын дэргэд тухлах шиг дулаахан.");
  });

  it("falls back to the name and perfumes without a description", () => {
    const p = buildCollectionImagePrompt({ name: "Gentleman", members });
    expect(p).toContain("No description");
  });

  it("clips a very long description", () => {
    const p = buildCollectionImagePrompt({
      description: "а".repeat(5000),
      members,
    });
    expect(p).toContain("…");
    expect(p.length).toBeLessThan(COLLECTION_BASE_PROMPT.length + 2000);
  });
});

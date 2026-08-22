import { describe, it, expect } from "vitest";
import { buildImagePrompt, DEFAULT_BASE_PROMPT } from "./build-image-prompt";

describe("buildImagePrompt", () => {
  it("starts with the base prompt", () => {
    const p = buildImagePrompt({ name: "Sauvage", brand: "Dior" });
    expect(p.startsWith(DEFAULT_BASE_PROMPT)).toBe(true);
  });

  it("includes the perfume, gender and character but never the notes", () => {
    const p = buildImagePrompt({
      name: "Aventus",
      brand: "Creed",
      gender: "male",
      shortDescription: "Bold and confident.",
    });
    expect(p).toContain("Perfume: Creed — Aventus");
    expect(p).toContain("Gender: male");
    expect(p).toContain("Bold and confident.");
    // Notes must not be baked into the scene.
    expect(p.toLowerCase()).not.toContain("notes:");
    expect(p.toLowerCase()).not.toContain("bergamot");
  });

  it("falls back to the long description when there is no short one", () => {
    const p = buildImagePrompt({ name: "X", description: "A calm morning." });
    expect(p).toContain("A calm morning.");
  });

  it("uses a custom base prompt", () => {
    const p = buildImagePrompt({ name: "X" }, "Custom base.");
    expect(p.startsWith("Custom base.")).toBe(true);
  });

  it("handles an empty product gracefully", () => {
    const p = buildImagePrompt({});
    expect(p.trim()).toBe(DEFAULT_BASE_PROMPT);
  });
});

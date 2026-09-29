import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FAQ_CATEGORIES } from "@/lib/constants";
import { FAQ_SEED } from "./seed";

/**
 * `0105_faq_seed.sql` нь `FAQ_SEED`-ийг хүснэгтэд суулгадаг — хоёр нь зөрвөл
 * demo горим ба сан өөр FAQ харуулна.
 */
describe("FAQ_SEED", () => {
  const sql = readFileSync(
    join(process.cwd(), "supabase", "migrations", "0105_faq_seed.sql"),
    "utf8",
  );

  it("uses only the fixed categories", () => {
    for (const f of FAQ_SEED) expect(FAQ_CATEGORIES).toContain(f.category);
  });

  it("matches the 0105 migration row for row, in order", () => {
    FAQ_SEED.forEach((f, i) => {
      expect(sql).toContain(
        `($faq$${f.category}$faq$, $faq$${f.question}$faq$, $faq$${f.answer}$faq$, ${i})`,
      );
    });
  });

  it("only seeds an empty table", () => {
    expect(sql).toMatch(/where not exists \(select 1 from faqs\)/);
  });
});

describe("groupFaqs", () => {
  it("puts the fixed categories first, in their order", async () => {
    const { groupFaqs } = await import("./seed");
    const groups = groupFaqs([
      { category: "Хүргэлт", question: "a", answer: "" },
      { category: "Хуучин", question: "b", answer: "" },
      { category: "Бараа", question: "c", answer: "" },
    ]);
    expect(groups.map((g) => g.title)).toEqual(["Бараа", "Хүргэлт", "Хуучин"]);
  });
});

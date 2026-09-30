import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FAQ_CATEGORIES } from "@/lib/constants";
import { FAQ_SEED } from "./seed";

/**
 * `0109_faq_sync.sql` нь `FAQ_SEED`-тэй ижил FAQ-г хүснэгтэд суулгадаг — хоёр
 * нь зөрвөл demo горим ба сан өөр FAQ харуулна.
 */
describe("FAQ_SEED", () => {
  const sql = readFileSync(
    join(process.cwd(), "supabase", "migrations", "0109_faq_sync.sql"),
    "utf8",
  );

  it("uses only the fixed categories", () => {
    for (const f of FAQ_SEED) expect(FAQ_CATEGORIES).toContain(f.category);
  });

  it("matches the 0109 migration row for row, in order", () => {
    FAQ_SEED.forEach((f, i) => {
      expect(sql).toContain(
        `$faq$${f.category}$faq$, $faq$${f.question}$faq$, $faq$${f.answer}$faq$, ${i}, true,`,
      );
    });
    expect(sql.match(/^  \('/gm)).toHaveLength(FAQ_SEED.length);
  });
});

describe("groupFaqs", () => {
  it("puts the fixed categories first, in their order", async () => {
    const { groupFaqs } = await import("./seed");
    const groups = groupFaqs([
      { category: "Хүргэлт", question: "a", answer: "" },
      { category: "Хуучин", question: "b", answer: "" },
      { category: "Хэмжээ ба багц", question: "c", answer: "" },
    ]);
    expect(groups.map((g) => g.title)).toEqual([
      "Хэмжээ ба багц",
      "Хүргэлт",
      "Хуучин",
    ]);
  });
});

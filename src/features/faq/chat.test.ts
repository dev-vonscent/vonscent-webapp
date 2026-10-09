import { describe, expect, it } from "vitest";
import { CHAT_FAQ_LIMIT } from "@/lib/constants";
import { isChatLimitError, pickChatFaqs } from "./chat";

const row = (n: number, chat_pinned = false) => ({
  category: "Хүргэлт",
  question: `Q${n}`,
  answer: `A${n}`,
  chat_pinned,
});

describe("pickChatFaqs", () => {
  it("shows only the pinned questions, in the given order", () => {
    const rows = [row(1), row(2, true), row(3), row(4, true)];
    expect(pickChatFaqs(rows).map((f) => f.question)).toEqual(["Q2", "Q4"]);
  });

  it("falls back to the first FAQs when none are pinned", () => {
    const rows = Array.from({ length: CHAT_FAQ_LIMIT + 5 }, (_, i) => row(i));
    const picked = pickChatFaqs(rows);
    expect(picked).toHaveLength(CHAT_FAQ_LIMIT);
    expect(picked[0].question).toBe("Q0");
  });

  it("never returns more than the limit", () => {
    const rows = Array.from({ length: CHAT_FAQ_LIMIT + 2 }, (_, i) =>
      row(i, true),
    );
    expect(pickChatFaqs(rows)).toHaveLength(CHAT_FAQ_LIMIT);
  });

  it("is empty when there are no FAQs at all", () => {
    expect(pickChatFaqs([])).toEqual([]);
  });
});

describe("isChatLimitError", () => {
  it("recognises the trigger's exception", () => {
    expect(isChatLimitError({ message: "CHAT_FAQ_LIMIT" })).toBe(true);
    expect(isChatLimitError({ message: "duplicate key" })).toBe(false);
    expect(isChatLimitError({})).toBe(false);
  });
});

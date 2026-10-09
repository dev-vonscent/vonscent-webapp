import { CHAT_FAQ_LIMIT } from "@/lib/constants";
import type { FaqRow } from "@/db/types";
import type { FaqItem } from "./seed";

/** Админд toast-оор гарах тул шууд монгол өгүүлбэр. */
export const CHAT_LIMIT_ERROR = `Чатад хамгийн ихдээ ${CHAT_FAQ_LIMIT} асуулт гарна. Өөр нэгийг нь эхлээд хасна уу.`;

/** DB-ийн trigger (0117) хязгаар давсныг илтгэсэн алдаа мөн эсэх. */
export function isChatLimitError(error: { message?: string }): boolean {
  return error.message?.includes("CHAT_FAQ_LIMIT") ?? false;
}

/**
 * Чатын цонхны бэлэн асуултууд: админы тэмдэглэсэн (`chat_pinned`) идэвхтэй
 * FAQ-ууд, `sort_order`-оор. Нэгийг ч тэмдэглээгүй бол эхний
 * `CHAT_FAQ_LIMIT` FAQ — tawk.to-г дөнгөж асаасан өдөр цонх хоосон гарахгүй.
 *
 * `rows` нь аль хэдийн `is_active` шүүгдэж, `sort_order`-оор эрэмбэлэгдсэн.
 */
export function pickChatFaqs(
  rows: Pick<FaqRow, "category" | "question" | "answer" | "chat_pinned">[],
): FaqItem[] {
  const pinned = rows.filter((r) => r.chat_pinned);
  return (pinned.length > 0 ? pinned : rows)
    .slice(0, CHAT_FAQ_LIMIT)
    .map(({ category, question, answer }) => ({ category, question, answer }));
}

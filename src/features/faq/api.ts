import "server-only";
import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";
import type { FaqRow } from "@/db/types";
import { sanitizeHtml, isRichText } from "@/lib/sanitize";
import { FAQ_SEED, type FaqItem } from "./seed";
import { pickChatFaqs } from "./chat";

/**
 * FAQ data access. Reads active FAQs from `faqs`; falls back to the seed when
 * Supabase isn't configured or the table is empty.
 */
export const getFaqs = cache(async (): Promise<FaqItem[]> => {
  if (!isSupabaseConfigured) return FAQ_SEED;
  const supabase = createPublicClient();
  if (!supabase) return FAQ_SEED;
  const { data } = await supabase
    .from("faqs")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  const rows = (data as FaqRow[] | null) ?? [];
  if (rows.length === 0) return FAQ_SEED;
  return rows.map((r) => ({
    category: r.category,
    question: r.question,
    answer: r.answer,
  }));
});

/**
 * Чатын цонхны бэлэн асуултууд (`pickChatFaqs`). Хариулт нь client
 * компонентод innerHTML-ээр зурагдах тул энд (server) цэвэрлэгдэнэ —
 * `lib/sanitize` нь server-only.
 */
export const getChatFaqs = cache(async (): Promise<FaqItem[]> => {
  let items: FaqItem[] = pickChatFaqs(
    FAQ_SEED.map((f) => ({ ...f, chat_pinned: false })),
  );
  const supabase = isSupabaseConfigured ? createPublicClient() : null;
  if (supabase) {
    const { data } = await supabase
      .from("faqs")
      .select("category, question, answer, chat_pinned")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    const rows = (data as FaqRow[] | null) ?? [];
    if (rows.length > 0) items = pickChatFaqs(rows);
  }
  return items.map((f) =>
    isRichText(f.answer) ? { ...f, answer: sanitizeHtml(f.answer) } : f,
  );
});

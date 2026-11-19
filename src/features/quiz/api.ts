import "server-only";
import { fetchProducts, withSale } from "@/features/products/api";
import { scoreQuizMatches, type QuizResult } from "./score";
import type { QuizAnswers } from "./questions";

/** Match the quiz answers against the live catalogue (development.md §3). */
export async function getQuizMatches(
  answers: QuizAnswers,
): Promise<QuizResult> {
  const all = await fetchProducts();
  const result = scoreQuizMatches(all, answers);
  // fetchProducts нь хямдралын товчгүй — картын тууз/үнэд хэрэгтэй.
  return { ...result, items: await withSale(result.items) };
}

import "server-only";
import { fetchProducts } from "@/features/products/api";
import { scoreQuizMatches, type QuizResult } from "./score";
import type { QuizAnswers } from "./questions";

/** Match the quiz answers against the live catalogue (development.md §3). */
export async function getQuizMatches(
  answers: QuizAnswers,
): Promise<QuizResult> {
  const all = await fetchProducts();
  return scoreQuizMatches(all, answers);
}

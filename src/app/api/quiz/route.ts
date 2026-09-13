import { NextResponse } from "next/server";
import { quizAnswersSchema } from "@/features/quiz/questions";
import { getQuizMatches } from "@/features/quiz/api";
import { enforceRateLimit } from "@/lib/rate-limit";

/**
 * "Үнэрээ ол" quiz matcher. Scoring stays server-side so the weights remain
 * consistent with getRelated() and the client never downloads the catalogue.
 *   POST /api/quiz  { gender, picks } → { items: ProductListItem[], fallback }
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = quizAnswersSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID" }, { status: 400 });
  }
  const limited = await enforceRateLimit("quiz", req);
  if (limited) return limited;

  const result = await getQuizMatches(parsed.data);
  return NextResponse.json(result);
}

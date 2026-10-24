import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { ScentQuiz } from "@/features/quiz/components/scent-quiz";

export const metadata: Metadata = {
  title: "Үнэрээ олох",
  description:
    "Хэдэн асуултад хариулаад өөрт тохирох үнэртнүүдээ олоорой — 2/5/10/20 мл decant.",
  ...pageMetadata("/quiz"),
};

/**
 * The existing scent quiz on a page of its own, so the header, drawer and
 * home card can link to it. Same component as before — answers survive a
 * trip to a product page exactly as they did on the home page.
 */
export default function QuizPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 pt-4 pb-10 md:px-8 md:pt-10 md:pb-16">
      <h1 className="sr-only">Үнэрээ олох</h1>
      <ScentQuiz />
    </div>
  );
}

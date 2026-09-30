import { Stars } from "@/components/shared/stars";
import {
  getCommentCount,
  getReviewPage,
  type ReviewTarget,
} from "@/features/reviews/api";
import { ReviewBoard } from "./review-board";

/**
 * Server-rendered reviews block for the product page — and, since 0107, the
 * bundle page: rating summary, the first page of reviews, and the (client)
 * submission form.
 *
 * Both numbers in the summary come from the review rows themselves, so the
 * header can't claim a different count from the list below it — and ratings
 * and written comments are stated separately, since a rating-only review is
 * allowed and renders as a card with stars and no text.
 */
export async function ReviewSection({
  target,
  path,
  ratingAvg,
}: {
  target: ReviewTarget;
  /** Нэвтрээд буцах хуудас — `/products/<slug>` эсвэл `/collections/<slug>`. */
  path: string;
  ratingAvg: number;
}) {
  const [page, commentCount] = await Promise.all([
    getReviewPage(target),
    getCommentCount(target),
  ]);

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <h2 className="font-serif text-2xl font-semibold tracking-tight sm:text-3xl">
          Үнэлгээ ба сэтгэгдэл
        </h2>
        {page.total > 0 && (
          <div className="flex items-center gap-2">
            <Stars rating={ratingAvg} />
            <span className="text-muted-foreground text-sm">
              {ratingAvg.toFixed(1)} · {page.total} үнэлгээ
              {commentCount > 0 && ` · ${commentCount} сэтгэгдэл`}
            </span>
          </div>
        )}
      </div>

      <ReviewBoard
        target={target}
        path={path}
        initial={page.reviews}
        total={page.total}
      />
    </section>
  );
}

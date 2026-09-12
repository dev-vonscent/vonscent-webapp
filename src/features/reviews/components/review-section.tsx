import { Stars } from "@/components/shared/stars";
import {
  getProductCommentCount,
  getProductReviewPage,
} from "@/features/reviews/api";
import { ReviewForm } from "./review-form";
import { ReviewList } from "./review-list";

/**
 * Server-rendered reviews block for the product page: rating summary, the
 * first page of reviews, and the (client) submission form.
 *
 * Both numbers in the summary come from the review rows themselves, so the
 * header can't claim a different count from the list below it — and ratings
 * and written comments are stated separately, since a rating-only review is
 * allowed and renders as a card with stars and no text.
 */
export async function ReviewSection({
  productId,
  slug,
  ratingAvg,
}: {
  productId: string;
  slug: string;
  ratingAvg: number;
}) {
  const [page, commentCount] = await Promise.all([
    getProductReviewPage(productId),
    getProductCommentCount(productId),
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

      {/* Жагсаалт зүүн талдаа бүтэн өргөнөө авч, форм нь баруун талд наалдаж
          үлдэнэ — уншиж байхад форм хайх шаардлагагүй. */}
      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <ReviewList
          productId={productId}
          initial={page.reviews}
          total={page.total}
        />
        <div className="lg:sticky lg:top-(--header-offset)">
          <ReviewForm productId={productId} slug={slug} />
        </div>
      </div>
    </section>
  );
}

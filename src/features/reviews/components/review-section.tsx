import Image from "next/image";
import { Stars } from "@/components/shared/stars";
import { formatTimeAgo } from "@/lib/format";
import { getProductReviews } from "@/features/reviews/api";
import { ReviewForm } from "./review-form";
import { DeleteReviewButton } from "./delete-review-button";

/** Round avatar — photo when available, otherwise the author's initial. */
function Avatar({ name, src }: { name: string; src: string | null }) {
  if (src) {
    return (
      <Image
        src={src}
        alt={name}
        width={40}
        height={40}
        unoptimized
        className="size-10 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span className="from-secondary to-accent text-foreground flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-sm font-semibold uppercase">
      {name.trim().charAt(0) || "?"}
    </span>
  );
}

/**
 * Server-rendered reviews block for the product page: rating summary, the
 * existing reviews, and the (client) submission form.
 */
export async function ReviewSection({
  productId,
  ratingAvg,
  ratingCount,
}: {
  productId: string;
  ratingAvg: number;
  ratingCount: number;
}) {
  const reviews = await getProductReviews(productId);

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <h2 className="font-serif text-xl font-semibold">
          Үнэлгээ ба сэтгэгдэл
        </h2>
        {ratingCount > 0 && (
          <div className="flex items-center gap-2">
            <Stars rating={ratingAvg} />
            <span className="text-muted-foreground text-sm">
              {ratingAvg.toFixed(1)} · {ratingCount} үнэлгээ
            </span>
          </div>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          {reviews.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Одоогоор сэтгэгдэл алга. Хамгийн түрүүнд үнэлгээ өгөөрэй.
            </p>
          ) : (
            reviews.map((r) => (
              <div
                key={r.id}
                className="border-border bg-card/40 hover:border-foreground/20 rounded-2xl border p-5 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <Avatar name={r.authorName} src={r.authorAvatar} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm leading-tight font-semibold">
                          {r.authorName}
                        </p>
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          {formatTimeAgo(r.createdAt)}
                        </p>
                      </div>
                      <DeleteReviewButton
                        reviewId={r.id}
                        productId={productId}
                      />
                    </div>
                    <Stars rating={r.rating} size={14} className="mt-2" />
                    {r.body && (
                      <p className="text-foreground/90 mt-3 text-sm leading-relaxed">
                        {r.body}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <ReviewForm productId={productId} />
      </div>
    </section>
  );
}

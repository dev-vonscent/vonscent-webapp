"use client";

import * as React from "react";
import Image from "next/image";
import { Stars } from "@/components/shared/stars";
import { Button } from "@/components/ui/button";
import { formatTimeAgo } from "@/lib/format";
import { REVIEWS_PAGE_SIZE } from "@/lib/constants";
import type { Review } from "@/features/reviews/types";
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
    <span className="from-secondary to-accent text-foreground flex size-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br text-sm font-semibold uppercase">
      {name.trim().charAt(0) || "?"}
    </span>
  );
}

function ReviewCard({
  review,
  onDeleted,
}: {
  review: Review;
  onDeleted: (id: string) => void;
}) {
  const edited = review.updatedAt > review.createdAt;
  return (
    <div className="border-border bg-card/40 hover:border-foreground/20 h-full rounded-2xl border p-5 transition-colors">
      <div className="flex items-start gap-3">
        <Avatar name={review.authorName} src={review.authorAvatar} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm/tight font-semibold">
                {review.authorName}
              </p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {formatTimeAgo(review.createdAt)}
                {edited && " · засварласан"}
              </p>
            </div>
            <DeleteReviewButton
              reviewId={review.id}
              onDeleted={() => onDeleted(review.id)}
            />
          </div>
          <Stars rating={review.rating} size={14} className="mt-2" />
          {review.body && (
            <p className="text-foreground/90 mt-3 text-sm/relaxed wrap-break-word">
              {review.body}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * The review list, paginated.
 *
 * The first page is rendered on the server (SEO + it stays in the ISR-cached
 * HTML); further pages are fetched here on demand. Before this the page pulled
 * *every* review for the product in one go, so a popular product rendered
 * hundreds of cards up front.
 */
export function ReviewList({
  productId,
  initial,
  total,
}: {
  productId: string;
  initial: Review[];
  total: number;
}) {
  const [items, setItems] = React.useState(initial);
  const [count, setCount] = React.useState(total);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(false);

  // A fresh server render (router.refresh() after a submit or a delete) hands
  // us a new array — adopt it as the new truth instead of keeping stale state.
  const [rendered, setRendered] = React.useState(initial);
  if (rendered !== initial) {
    setRendered(initial);
    setItems(initial);
    setCount(total);
  }

  async function loadMore() {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(
        `/api/reviews?productId=${productId}&offset=${items.length}`,
      );
      if (!res.ok) throw new Error();
      const page = (await res.json()) as { reviews: Review[]; total: number };
      // Guard against a review inserted between page loads shifting the window.
      setItems((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        return [...prev, ...page.reviews.filter((r) => !seen.has(r.id))];
      });
      setCount(page.total);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  function handleDeleted(id: string) {
    setItems((prev) => prev.filter((r) => r.id !== id));
    setCount((c) => Math.max(0, c - 1));
  }

  if (items.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Одоогоор сэтгэгдэл алга. Хамгийн түрүүнд үнэлгээ өгөөрэй.
      </p>
    );
  }

  return (
    // Хоёр багана — нэг урт баганад жагсаахад хуудас хэт сунаж, нэг баганад
    // мөрийн урт ~200 тэмдэгт болж уншихад хүндэрдэг.
    //
    // Мөр доторх картууд ТЭГШ өндөртэй (`h-full`, `items-start` БИШ): өмнө нь
    // богино сэтгэгдлийн доор санамсаргүй цоорхой үүсч, сүлжээ эвдэрсэн
    // харагддаг байв. Текст 200 тэмдэгтээр хязгаарлагдсан тул мөрийн өндрийн
    // зөрүү нь хязгаарлагдмал.
    <div className="grid gap-4 sm:grid-cols-2">
      {items.map((r) => (
        <ReviewCard key={r.id} review={r} onDeleted={handleDeleted} />
      ))}

      {items.length < count && (
        <div className="space-y-2 sm:col-span-2">
          <Button
            variant="secondary"
            className="w-full"
            onClick={loadMore}
            disabled={loading}
          >
            {loading
              ? "Ачааллаж байна…"
              : `Цааш үзэх (${Math.min(REVIEWS_PAGE_SIZE, count - items.length)})`}
          </Button>
          {error && (
            <p className="text-destructive text-sm">
              Сэтгэгдэл ачаалахад алдаа гарлаа. Дахин оролдоно уу.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

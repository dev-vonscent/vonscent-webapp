"use client";

import * as React from "react";
import Image from "next/image";
import { Stars } from "@/components/shared/stars";
import { LoadingButton } from "@/components/shared/loading-button";
import { formatTimeAgo } from "@/lib/format";
import { REVIEWS_PAGE_SIZE } from "@/lib/constants";
import {
  targetParam,
  type Review,
  type ReviewTarget,
} from "@/features/reviews/types";
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
    <article className="py-5 first:pt-0">
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
            <p className="text-foreground/90 mt-2 max-w-prose text-sm/relaxed wrap-break-word">
              {review.body}
            </p>
          )}
        </div>
      </div>
    </article>
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
  target,
  initial,
  total,
  own = null,
}: {
  target: ReviewTarget;
  initial: Review[];
  total: number;
  /** Хэрэглэгчийн дөнгөж хадгалсан сэтгэгдэл (ReviewBoard). */
  own?: Review | null;
}) {
  const [items, setItems] = React.useState(initial);
  const [count, setCount] = React.useState(total);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(false);
  // Устгасан id — `own`-оор оройд барьсан мөрийг ч дахин гаргахгүй.
  const [removed, setRemoved] = React.useState<ReadonlySet<string>>(new Set());

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
      const query = new URLSearchParams({
        ...targetParam(target),
        offset: String(items.length),
      });
      const res = await fetch(`/api/reviews?${query}`);
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
    setRemoved((prev) => new Set(prev).add(id));
    setItems((prev) => prev.filter((r) => r.id !== id));
    setCount((c) => Math.max(0, c - 1));
  }

  // Өөрийн сэтгэгдэл оройд — серверийн шинэ render ирээгүй байсан ч харагдана.
  // Ирсэн бол id-аар давхардлыг хасна.
  const pinned = own && !removed.has(own.id) ? own : null;
  const shown = pinned
    ? [pinned, ...items.filter((r) => r.id !== pinned.id)]
    : items;

  if (shown.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Одоогоор сэтгэгдэл алга. Хамгийн түрүүнд үнэлгээ өгөөрэй.
      </p>
    );
  }

  return (
    // Нэг багана, зураасаар тусгаарласан — сэтгэгдлийн урт тэс өөр тул картын
    // сүлжээнд эгнээ бүр хамгийн урт сэтгэгдлээрээ сунаж, богинохон нь хоосон
    // хайрцаг болж харагддаг байв. Уншигдах мөрийн уртыг `max-w-prose` барина.
    <div>
      <div className="divide-border divide-y">
        {shown.map((r) => (
          <ReviewCard key={r.id} review={r} onDeleted={handleDeleted} />
        ))}
      </div>

      {items.length < count && (
        <div className="mt-2 space-y-2">
          <LoadingButton
            loading={loading}
            variant="secondary"
            className="w-full"
            onClick={loadMore}
          >{`Цааш үзэх (${Math.min(REVIEWS_PAGE_SIZE, count - items.length)})`}</LoadingButton>
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

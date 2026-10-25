"use client";

import * as React from "react";
import type { Review, ReviewTarget } from "@/features/reviews/types";
import { useFeatureFlag } from "@/components/feature-flags";
import { ModeratedReviewForm } from "./moderated-review-form";
import { ReviewForm } from "./review-form";
import { ReviewList } from "./review-list";

/**
 * Жагсаалт + форм. Хэрэглэгчийн дөнгөж хадгалсан сэтгэгдлийг энд барьж
 * жагсаалтын оройд шууд харуулна — хуудас ISR-ээр кэшлэгддэг тул
 * `router.refresh()` шинэ мөрийг тэр дороо авчирна гэсэн баталгаа байхгүй.
 */
export function ReviewBoard({
  target,
  path,
  initial,
  total,
}: {
  target: ReviewTarget;
  path: string;
  initial: Review[];
  total: number;
}) {
  const [own, setOwn] = React.useState<Review | null>(null);
  // Туг `review_moderation` (0162): шалгагдах хүртэл жагсаалтад гарахгүй тул
  // `own`-оор оройд барихгүй.
  const moderated = useFeatureFlag("review_moderation");

  return (
    // Дээрх зураг / мэдээллийн 50/50 сүлжээтэй ижил багана, ижил зай — хуудас
    // нэг босоо шугамаар уншигдана. Форм баруун талд наалдаж үлдэнэ.
    // `items-start`: жагсаалт формын өндрөөр сунахгүй.
    <div className="grid items-start gap-8 sm:gap-10 lg:grid-cols-2">
      <ReviewList target={target} initial={initial} total={total} own={own} />
      <div className="lg:sticky lg:top-(--header-offset)">
        {moderated ? (
          <ModeratedReviewForm target={target} path={path} />
        ) : (
          <ReviewForm target={target} path={path} onSaved={setOwn} />
        )}
      </div>
    </div>
  );
}

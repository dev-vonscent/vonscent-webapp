"use client";

import * as React from "react";
import type { Review, ReviewTarget } from "@/features/reviews/types";
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

  return (
    // Дээрх зураг / мэдээллийн 50/50 сүлжээтэй ижил багана, ижил зай — хуудас
    // нэг босоо шугамаар уншигдана. Форм баруун талд наалдаж үлдэнэ.
    // `items-start`: жагсаалт формын өндрөөр сунахгүй.
    <div className="grid items-start gap-8 sm:gap-10 lg:grid-cols-2">
      <ReviewList target={target} initial={initial} total={total} own={own} />
      <div className="lg:sticky lg:top-(--header-offset)">
        <ReviewForm target={target} path={path} onSaved={setOwn} />
      </div>
    </div>
  );
}

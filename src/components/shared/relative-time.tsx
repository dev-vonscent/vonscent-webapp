"use client";

import * as React from "react";
import { formatDate, formatTimeAgo } from "@/lib/format";

const noopSubscribe = () => () => {};

/**
 * «3 өдрийн өмнө» — гэхдээ зөвхөн браузар дээр.
 *
 * Сервер (ISR) тогтмол огноо (`2026.09.08`) бичнэ: харьцаангуй хугацааг SSR-д
 * гаргавал HTML нь цаг өнгөрөх тусам өөрчлөгдөж, хуудас дахин бичигдэх бүрт
 * өөр гарна. `useSyncExternalStore`-ийн серверийн snapshot нь hydration-д ч
 * хэрэглэгддэг тул анхны client render серверийнхтэй яг ижил (mismatch-гүй),
 * дараа нь харьцаангуй руу шилжинэ. Hydration-гүй render (жишээ нь «Цааш
 * үзэх»-ээр нэмэгдсэн мөр) шууд харьцаангуйгаар гарна.
 */
export function RelativeTime({ value }: { value: string }) {
  const hydrated = React.useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const absolute = formatDate(value);
  return (
    <time dateTime={value} title={absolute}>
      {hydrated ? formatTimeAgo(value) : absolute}
    </time>
  );
}

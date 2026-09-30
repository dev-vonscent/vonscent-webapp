"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

/** Шинэ төлөв буухыг хүлээх дээд хугацаа — сүлжээ гацвал UI түгжигдэхгүй. */
const REFRESH_TIMEOUT_MS = 8000;

/**
 * `router.refresh()`-ийн хүлээж болох хувилбар: шинэ server өгөгдөл дэлгэцэнд
 * БУУХАД шийдэгдэх promise буцаана.
 *
 * `router.refresh()` өөрөө void — хэзээ дуусахыг зөвхөн transition-ий
 * `pending` хэлнэ. Цонх (цуцлах г.м) шинэ төлөв гартал loader-тэй нээлттэй
 * байхын тулд promise-ыг `pending` унтрахад шийднэ. Transition-д хамт commit
 * хийгдэх `tick` нь refresh шууд дуусаж `pending` огт асахгүй байсан ч
 * effect-ийг ажиллуулна.
 */
export function useRefreshAndWait(): () => Promise<void> {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [tick, setTick] = React.useState(0);
  const done = React.useRef<(() => void) | null>(null);

  React.useEffect(() => {
    if (!pending && done.current) {
      done.current();
      done.current = null;
    }
  }, [pending, tick]);

  return React.useCallback(
    () =>
      new Promise<void>((resolve) => {
        done.current = resolve;
        startTransition(() => {
          router.refresh();
          setTick((n) => n + 1);
        });
        setTimeout(resolve, REFRESH_TIMEOUT_MS);
      }),
    [router],
  );
}

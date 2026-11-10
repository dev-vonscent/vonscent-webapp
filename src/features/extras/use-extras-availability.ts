"use client";

import * as React from "react";
import { useCart, type CartExtra } from "@/features/cart/store";
import { numAblative } from "@/lib/mn-grammar";

export interface ExtraLineStatus {
  /** Худалдаанаас хасагдсан, туг хаалттай. */
  gone: boolean;
  /** null = хязгааргүй (тоолж эхлээгүй сав) эсвэл хараахан мэдэгдээгүй. */
  available: number | null;
}

const OK: ExtraLineStatus = { gone: false, available: null };

/**
 * Сагсны нэмэлт барааны мөр одоо зарагдах уу (extras-shop-plan §10).
 *
 * Үнэртний `useCartAvailability`-тай ижил санаа, гэхдээ тоог автоматаар
 * БАГАСГАХГҮЙ — «Таны сонгосон 3-аас 1 ширхэг үлдсэн байна» гэж хэлээд
 * «1 болгох / Хасах»-ыг хэрэглэгчид өгнө. Зарагдсан шил, хасагдсан бараа
 * сонголтоос гарна. Сангийн үнэ сагсныхаас өөр бол сагсны үнийг шинэчилнэ —
 * хэрэглэгч checkout-ийн тоймоос өмнө шинэ үнийг хардаг.
 */
export function useExtrasAvailability({
  enabled = true,
  buyNow = false,
}: { enabled?: boolean; buyNow?: boolean } = {}) {
  const cartExtras = useCart((s) => s.extras);
  const buyNowLine = useCart((s) => s.buyNow);
  const extras: CartExtra[] = React.useMemo(
    () =>
      !buyNow
        ? cartExtras
        : buyNowLine?.kind === "extra"
          ? [buyNowLine.extra]
          : [],
    [buyNow, buyNowLine, cartExtras],
  );
  const idKey = React.useMemo(
    () => [...new Set(extras.map((e) => e.extraVariantId))].sort().join(","),
    [extras],
  );
  const [byId, setById] = React.useState<Map<string, number | null> | null>(
    null,
  );
  const [checkedKey, setCheckedKey] = React.useState<string | null>(null);
  const setExtraPrices = useCart((s) => s.setExtraPrices);

  React.useEffect(() => {
    if (!idKey || !enabled) {
      setById(null);
      setCheckedKey(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/extras/status?ids=${idKey}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (
          data: {
            items?: { id: string; price: number; available: number | null }[];
          } | null,
        ) => {
          if (cancelled || !data?.items) return;
          setById(new Map(data.items.map((i) => [i.id, i.available])));
          setCheckedKey(idKey);
          const prices: Record<string, number> = {};
          for (const i of data.items) prices[i.id] = i.price;
          setExtraPrices(prices);
        },
      )
      // Сүлжээ унасан бол сагсыг түгжихгүй — сервер checkout дээр хамгаална.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [idKey, enabled, setExtraPrices]);

  const statusOf = React.useCallback(
    (key: string): ExtraLineStatus => {
      if (!byId || checkedKey !== idKey) return OK;
      if (!byId.has(key)) return { gone: true, available: 0 };
      return { gone: false, available: byId.get(key) ?? null };
    },
    [byId, checkedKey, idKey],
  );

  const blockedExtraKeys = React.useMemo(
    () =>
      new Set(
        extras
          .filter((e) => {
            const s = statusOf(e.key);
            return s.gone || s.available === 0;
          })
          .map((e) => e.key),
      ),
    [extras, statusOf],
  );

  // Захиалж болохгүй мөрийг сонголтоос гаргана (сагсны үнэртний мөртэй ижил).
  const excludedExtras = useCart((s) => s.excludedExtras);
  const setExtraSelected = useCart((s) => s.setExtraSelected);
  React.useEffect(() => {
    if (buyNow) return;
    for (const key of blockedExtraKeys) {
      if (!excludedExtras.includes(key)) setExtraSelected(key, false);
    }
  }, [buyNow, blockedExtraKeys, excludedExtras, setExtraSelected]);

  return { statusOf, blockedExtraKeys };
}

/** Мөрийн доорх тайлбар — хоосон бол асуудалгүй. */
export function extraIssueLabel(
  line: Pick<CartExtra, "qty" | "mode">,
  status: ExtraLineStatus,
): string {
  if (status.gone) return "Энэ бараа худалдаанаас хасагдсан байна.";
  if (status.available === 0) {
    return line.mode === "leftover_liquid"
      ? "Энэ үлдэгдэлтэй шил саяхан зарагдсан байна."
      : "Энэ бараа дууссан байна.";
  }
  if (status.available != null && line.qty > status.available) {
    return `Таны сонгосон ${numAblative(line.qty)} ${status.available} ширхэг үлдсэн байна.`;
  }
  return "";
}

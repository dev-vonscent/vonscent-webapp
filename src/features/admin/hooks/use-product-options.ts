"use client";

import * as React from "react";
import { adminFetch } from "@/features/admin/lib/mutate";
import {
  PRODUCT_OPTION_LIMIT,
  type ProductOption,
} from "@/features/admin/lib/product-option";

/**
 * Барааны сонгогчийн эх сурвалж — хайлт нь СЕРВЕР дээр.
 *
 * Өмнө нь гурван дэлгэц (бэлгийн сан, нүүрийн хэсэг, багцын форм) бүх
 * каталогийг props-оор хүлээж аваад санах ойд шүүдэг байв. Одоо:
 *   · эхлэхдээ сервер сонгогдсон бараа + эхний хуудсыг өгнө;
 *   · бичих бүрд (250мс debounce) шинэ хуудсыг сервер шүүж өгнө;
 *   · нэг удаа харсан мөр бүр `byId`-д үлдэнэ — сонгосон бараа хайлт солиход
 *     нэрээ алдахгүй (chip, сануулга бүгд нэрээрээ харагдана).
 */
export function useProductOptions(initial: ProductOption[]) {
  const [q, setQ] = React.useState("");
  const [items, setItems] = React.useState<ProductOption[]>(initial);
  const [loading, setLoading] = React.useState(false);
  // Харсан бүх мөрийн сан. `useState` биш `useRef`: энэ нь зурагдалтыг
  // өдөөх ёсгүй кэш, `items` солигдоход л дүр зураг шинэчлэгдэнэ.
  const seen = React.useRef(new Map(initial.map((p) => [p.id, p])));

  // Эхний хуудсыг сервер аль хэдийн өгсөн — ачаалахад дахин татахгүй. Нэг
  // хуудсан дээр хэд хэдэн сонгогч байж болох тул (нүүрийн хэсгүүд) энэ нь
  // ижилхэн хүсэлт олон удаа явахаас ч сэргийлнэ.
  const primed = React.useRef(false);

  React.useEffect(() => {
    if (!primed.current) {
      primed.current = true;
      return;
    }
    const term = q.trim();
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      const res = await adminFetch<{ items: ProductOption[] }>(
        `/api/admin/products/options?q=${encodeURIComponent(term)}&limit=${PRODUCT_OPTION_LIMIT}`,
      );
      if (cancelled) return;
      if (res.ok) {
        for (const p of res.data.items) seen.current.set(p.id, p);
        setItems(res.data.items);
      }
      setLoading(false);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  /** Хэзээ нэгэн цагт харсан бараа — сонгогдсоныг нэрлэхэд хэрэглэнэ. */
  const byId = React.useCallback(
    (id: string) => seen.current.get(id),
    // `seen` нь ref тул хамаарал байхгүй; `items` солигдоход шинэ функц өгч
    // хэрэглэгчийн memo-г зөв шинэчилнэ.
    [items], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return { q, setQ, items, loading, byId };
}

"use client";

import * as React from "react";
import { useCheckoutLines } from "@/features/cart/use-cart-selection";
import type { Gender } from "@/lib/constants";
import { leadGender } from "./gender";

/**
 * Захиалгад орох мөрүүдийн давамгай хүйс — бэлгийн мөрийн аль бүлгийг
 * түрүүлж харуулахыг шийднэ. Сагсны мөр хүйсээ хадгалдаггүй тул барааны
 * жагсаалтын хэлбэрээр (`/api/products?ids=`) нэг удаа асууна. Мэдээлэл
 * ирээгүй / алдаа гарвал `null` — өгөгдмөл дараалал.
 */
export function useLeadGender(): "male" | "female" | null {
  const { items, collections } = useCheckoutLines();

  const lines = React.useMemo(() => {
    const out: { productId: string; ml: number }[] = [];
    for (const i of items)
      out.push({ productId: i.productId, ml: i.ml * i.qty });
    for (const c of collections)
      for (const m of c.members)
        out.push({ productId: m.productId, ml: c.ml * c.qty });
    return out;
  }, [items, collections]);

  const idKey = React.useMemo(
    () => [...new Set(lines.map((l) => l.productId))].sort().join(","),
    [lines],
  );

  const [genders, setGenders] = React.useState<Map<string, Gender> | null>(
    null,
  );

  React.useEffect(() => {
    if (!idKey) return;
    let cancelled = false;
    fetch(`/api/products?ids=${idKey}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !Array.isArray(data?.items)) return;
        const map = new Map<string, Gender>();
        for (const p of data.items as { id: string; gender: Gender }[])
          map.set(p.id, p.gender);
        setGenders(map);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [idKey]);

  return React.useMemo(
    () => (genders ? leadGender(lines, (id) => genders.get(id)) : null),
    [genders, lines],
  );
}

"use client";

import * as React from "react";
import { ProductGallery } from "@/features/products/components/product-gallery";

/**
 * Хувилбарын зураг ↔ галерей (бэлгийн сав, 0153 `image_url`). Хуудасны
 * зүүн талын галерей ба баруун талын «Захиалах» тусдаа компонент тул
 * хоёрыг энэ context холбоно: хувилбар сонгоход галерей тэр зураг руу
 * гүйнэ. `n` — ижил хувилбарыг дахин сонгоход ч (хооронд нь гараар
 * гүйлгэсэн бол) дахин гүйлгэнэ.
 */
type Focus = { url: string; n: number } | null;

const Ctx = React.createContext<{
  focus: Focus;
  show: (url: string | null) => void;
} | null>(null);

export function VariantImageProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [focus, setFocus] = React.useState<Focus>(null);
  const show = React.useCallback((url: string | null) => {
    if (url) setFocus((f) => ({ url, n: (f?.n ?? 0) + 1 }));
  }, []);
  const value = React.useMemo(() => ({ focus, show }), [focus, show]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Provider-гүй (жишээ нь тест) үед юу ч хийхгүй. */
export function useShowVariantImage() {
  return React.useContext(Ctx)?.show ?? (() => {});
}

export function ExtraGallery(
  props: Omit<React.ComponentProps<typeof ProductGallery>, "focus">,
) {
  const focus = React.useContext(Ctx)?.focus ?? null;
  return <ProductGallery {...props} focus={focus} />;
}

"use client";

import * as React from "react";
import { useFeatureFlag } from "@/components/feature-flags";

/**
 * Одоо явж буй арга хэмжээ (0181) — client component-уудад (каталогийн chip,
 * барааны картын badge). Shop layout серверээс `getLiveSaleEvents()`-ийн
 * хэрэгтэй хэсгийг л дамжуулна: товлосон арга хэмжээ HTML-д орохгүй (хувь нь
 * зөвхөн LIVE — үнээрээ аль хэдийн ил).
 *
 * Зөвхөн харагдац — үнэ нь SQL-ийн `variant_price()`-ээс (plan §5.2).
 */
interface SaleEventsValue {
  /** Каталогийн «Таг» бүлгийн chip. */
  events: readonly { slug: string; name: string }[];
  /** productId → картан дээрх тэмдэг (`badge_label`-тай арга хэмжээ л). */
  badges: Readonly<Record<string, string>>;
  /** productId → live арга хэмжээн дэх хамгийн их хувь (тэмдгийн «~10%»). */
  pcts: Readonly<Record<string, number>>;
}

const EMPTY: SaleEventsValue = { events: [], badges: {}, pcts: {} };
const SaleEventsContext = React.createContext<SaleEventsValue>(EMPTY);

export function SaleEventsProvider({
  events,
  badges,
  pcts,
  children,
}: SaleEventsValue & { children: React.ReactNode }) {
  const value = React.useMemo(
    () => ({ events, badges, pcts }),
    [events, badges, pcts],
  );
  return (
    <SaleEventsContext.Provider value={value}>
      {children}
    </SaleEventsContext.Provider>
  );
}

/** Тугийн client давхарга: хаалттай бол хоосон (серверээс ч хоосон ирнэ). */
function useValue(): SaleEventsValue {
  const on = useFeatureFlag("sale_events");
  const value = React.useContext(SaleEventsContext);
  return on ? value : EMPTY;
}

export function useLiveSaleEvents() {
  return useValue().events;
}

/** Энэ бараа `badge_label`-тай live арга хэмжээнд байвал тэр тэмдэг. */
export function useSaleEventBadge(productId: string): string | null {
  return useValue().badges[productId] ?? null;
}

/** Энэ бараа live арга хэмжээнд хувьтай байвал хамгийн их хувь. */
export function useSaleEventPct(productId: string): number | null {
  return useValue().pcts[productId] ?? null;
}

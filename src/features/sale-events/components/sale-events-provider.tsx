"use client";

import * as React from "react";
import { useFeatureFlag } from "@/components/feature-flags";
import type { SaleEventTickerTheme } from "@/lib/constants";

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
  events: readonly {
    slug: string;
    name: string;
    /** Зурвасны өнгө — шүүлтүүрийн chip ижил өнгөтэй (`EventFilterChip`). */
    tickerTheme: SaleEventTickerTheme;
    /** Картан дээрх тэмдэг (0181 `badge_label`) — багцын картад (16.7). */
    badgeLabel?: string | null;
  }[];
  /** productId → картан дээрх тэмдэг (`badge_label`-тай арга хэмжээ л). */
  badges: Readonly<Record<string, string>>;
  /** productId → live арга хэмжээн дэх хамгийн их хувь (тэмдгийн «~10%»). */
  pcts: Readonly<Record<string, number>>;
  /** productId → арга хэмжээний зурвасны өнгө (тэмдэг ижил өнгөтэй). */
  themes: Readonly<Record<string, SaleEventTickerTheme>>;
}

const EMPTY: SaleEventsValue = { events: [], badges: {}, pcts: {}, themes: {} };
const SaleEventsContext = React.createContext<SaleEventsValue>(EMPTY);

export function SaleEventsProvider({
  events,
  badges,
  pcts,
  themes,
  children,
}: SaleEventsValue & { children: React.ReactNode }) {
  const value = React.useMemo(
    () => ({ events, badges, pcts, themes }),
    [events, badges, pcts, themes],
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

/** Энэ бараа live арга хэмжээнд байвал тэр арга хэмжээний зурвасны өнгө. */
export function useSaleEventTheme(
  productId: string,
): SaleEventTickerTheme | null {
  return useValue().themes[productId] ?? null;
}

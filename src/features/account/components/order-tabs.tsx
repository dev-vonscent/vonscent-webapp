"use client";

import * as React from "react";
import {
  SegmentedTabs,
  type SegmentedTab,
} from "@/components/shared/segmented-tabs";

export type OrderTabKey =
  | "all"
  | "active"
  | "saved"
  | "delivered"
  | "cancelled";

/**
 * «Миний захиалга»-ын табууд — шүүлт нь клиент дээр.
 *
 * Сервер бүх захиалгыг нэг удаа татаж, карт бүрийг нэг л удаа зурж ирүүлнэ;
 * таб солиход энд зөвхөн шүүнэ. Өмнө нь таб бүр линк байсан тул дарах бүрт
 * хуудас бүхэлдээ (auth, хугацаа дууссан захиалгын цэгцлэл, захиалга, барааны
 * зураг) серверт дахин ажиллаж, шилжилт удаан байв.
 *
 * Таб нь URL-д (`?tab=`) хэвээр — `replaceState` нь серверт хүсэлт явуулахгүй,
 * харин refresh, буцах, хуваалцсан холбоос тухайн табаа нээнэ.
 */
export function OrderTabs({
  tabs,
  initialTab,
  orders,
  saved,
  empty,
}: {
  tabs: readonly SegmentedTab<OrderTabKey>[];
  initialTab: OrderTabKey;
  /** Серверийн эрэмбээр (төлбөр хүлээж буй нь эхэнд). */
  orders: {
    id: string;
    tab: Exclude<OrderTabKey, "all" | "saved">;
    card: React.ReactNode;
  }[];
  saved: React.ReactNode;
  empty: Record<OrderTabKey, React.ReactNode>;
}) {
  const [tab, setTab] = React.useState(initialTab);

  function select(next: OrderTabKey) {
    setTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState(window.history.state, "", url);
  }

  const shown = orders.filter((o) => tab === "all" || o.tab === tab);

  return (
    <>
      <SegmentedTabs
        label="Захиалгын ангилал"
        tabs={tabs}
        value={tab}
        onChange={select}
      />
      <div role="tabpanel">
        {tab === "saved" ? (
          saved
        ) : shown.length === 0 ? (
          empty[tab]
        ) : (
          <div className="space-y-4">
            {shown.map((o) => (
              <React.Fragment key={o.id}>{o.card}</React.Fragment>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

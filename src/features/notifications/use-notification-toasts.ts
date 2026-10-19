"use client";

import * as React from "react";
import { planToasts, type ToastPlan } from "./lib";
import {
  useNotificationPoll,
  useNotificationUserId,
} from "./use-notifications";

const CHANNEL = "vonscent-notifications";

/**
 * Tab-д нэг удаа үзүүлсэн id ба боловсруулсан poll `seq` — module түвшинд:
 * header нь layout бүрт (shop / account) тусдаа mount болдог тул ref-д
 * хадгалвал layout солигдоход кэштэй сүүлийн хариу дахин toast болно.
 */
const shown = new Set<string>();
let handled: { userId: string | null; seq: number } = { userId: null, seq: 0 };

/**
 * Poll-ын шинэ хариу бүрээс toast-ын төлөвлөгөө гаргаж `show`-д өгнө.
 * Зөвхөн харагдаж буй tab гаргана; бусад tab-д `BroadcastChannel`-аар
 * үзүүлсэн id-аа хуваалцана (best-effort, plan §6).
 */
export function useNotificationToasts(show: (plan: ToastPlan) => void) {
  const userId = useNotificationUserId();
  const { data } = useNotificationPoll();
  const channel = React.useRef<BroadcastChannel | null>(null);
  const showRef = React.useRef(show);
  React.useEffect(() => {
    showRef.current = show;
  });

  React.useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel(CHANNEL);
    ch.onmessage = (e: MessageEvent<{ ids?: unknown }>) => {
      const ids = Array.isArray(e.data?.ids) ? e.data.ids : [];
      for (const id of ids) if (typeof id === "string") shown.add(id);
    };
    channel.current = ch;
    return () => {
      ch.close();
      channel.current = null;
    };
  }, []);

  React.useEffect(() => {
    if (!data || !userId) return;
    if (handled.userId !== userId) {
      handled = { userId, seq: 0 };
      shown.clear();
    }
    if (data.seq <= handled.seq) return;
    handled.seq = data.seq;

    const plan = planToasts({
      fresh: data.fresh,
      freshCount: data.freshCount,
      initial: data.seq === 1,
      visible: document.visibilityState === "visible",
      shown,
    });
    // Үзүүлээгүй ч (далд tab) тэмдэглэнэ — tab харагдах үед хуучин мөрийг
    // дахин toast болгохгүй; panel/badge-д хэвээр байна.
    const ids = data.fresh.map((n) => n.id);
    for (const id of ids) shown.add(id);
    if (plan.type === "none") return;
    channel.current?.postMessage({ ids });
    showRef.current(plan);
  }, [data, userId]);
}

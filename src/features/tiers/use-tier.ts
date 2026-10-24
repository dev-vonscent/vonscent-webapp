"use client";

import { useQuery } from "@tanstack/react-query";
import { useFeatureFlag } from "@/components/feature-flags";
import type { TierSummary } from "./types";

export const TIER_QUERY_KEY = ["account", "tier"] as const;

/**
 * Өөрийн түвшин ба топ жагсаалт (`/api/account/tier`). Туг хаалттай бол
 * хүсэлт ч явуулахгүй — `data` нь `undefined` хэвээр, UI түвшингүй харагдана.
 */
export function useMyTier(options: { enabled?: boolean } = {}) {
  const flagOn = useFeatureFlag("user_tiers");
  return useQuery<TierSummary>({
    queryKey: TIER_QUERY_KEY,
    queryFn: async () => {
      const res = await fetch("/api/account/tier", { cache: "no-store" });
      if (!res.ok) throw new Error("tier_failed");
      return res.json();
    },
    enabled: flagOn && (options.enabled ?? true),
    staleTime: 60_000,
    // Зочинд 401 — давтах утгагүй.
    retry: 1,
  });
}

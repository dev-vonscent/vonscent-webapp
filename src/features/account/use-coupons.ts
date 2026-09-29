"use client";

import { useQuery } from "@tanstack/react-query";
import type { WalletCoupon } from "./components/coupons";

export const WALLET_QUERY_KEY = ["account", "coupons"] as const;

/** The customer's coupons — every status, one row each (0104). */
export function useWallet() {
  return useQuery<WalletCoupon[]>({
    queryKey: WALLET_QUERY_KEY,
    queryFn: async () => {
      const res = await fetch("/api/account/coupons", { cache: "no-store" });
      if (!res.ok) throw new Error("wallet_failed");
      const data = (await res.json()) as { coupons?: WalletCoupon[] };
      return data.coupons ?? [];
    },
    // A shared code can be spent by someone else at any moment.
    staleTime: 15_000,
  });
}

/** One coupon of the customer's own; null when it is not theirs or gone. */
export function useWalletCoupon(code: string) {
  return useQuery<WalletCoupon | null>({
    queryKey: [...WALLET_QUERY_KEY, code.toUpperCase()],
    queryFn: async () => {
      const res = await fetch(
        `/api/account/coupons/${encodeURIComponent(code)}`,
        { cache: "no-store" },
      );
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("coupon_failed");
      const data = (await res.json()) as { coupon?: WalletCoupon };
      return data.coupon ?? null;
    },
    staleTime: 15_000,
  });
}

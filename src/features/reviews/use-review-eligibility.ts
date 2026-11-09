"use client";

import { useQuery } from "@tanstack/react-query";
import { useFeatureFlag } from "@/components/feature-flags";
import {
  targetParam,
  type ReviewEligibility,
  type ReviewTarget,
} from "./types";

export function reviewEligibilityKey(target: ReviewTarget) {
  return ["reviews", "eligibility", target.kind, target.id] as const;
}

/**
 * Хяналттай формын төлөв (`/api/reviews/eligibility`, 0162). Туг хаалттай бол
 * хүсэлт явуулахгүй.
 */
export function useReviewEligibility(target: ReviewTarget) {
  const flagOn = useFeatureFlag("review_moderation");
  return useQuery<ReviewEligibility>({
    queryKey: reviewEligibilityKey(target),
    queryFn: async () => {
      const query = new URLSearchParams(targetParam(target));
      const res = await fetch(`/api/reviews/eligibility?${query}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("eligibility_failed");
      return res.json();
    },
    enabled: flagOn,
    staleTime: 30_000,
    retry: 1,
  });
}

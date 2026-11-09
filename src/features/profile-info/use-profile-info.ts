"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFeatureFlag } from "@/components/feature-flags";
import { PROFILE_SUMMARY_KEY } from "@/features/account/use-profile-summary";
import type { ProfileInfoPatch } from "@/lib/validators/profile-info";
import type { ProfileInfo } from "./types";

export const PROFILE_INFO_QUERY_KEY = ["account", "profile-info"] as const;

/** «Миний мэдээлэл» (`/api/account/profile-info`). Туг хаалттай бол хүсэлтгүй. */
export function useProfileInfo() {
  const flagOn = useFeatureFlag("profile_info");
  return useQuery<ProfileInfo>({
    queryKey: PROFILE_INFO_QUERY_KEY,
    queryFn: async () => {
      const res = await fetch("/api/account/profile-info", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("profile_info_failed");
      return res.json();
    },
    enabled: flagOn,
    retry: 1,
  });
}

export class ProfileInfoSaveError extends Error {}

export function useUpdateProfileInfo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: ProfileInfoPatch) => {
      const res = await fetch("/api/account/profile-info", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new ProfileInfoSaveError(data?.error ?? "SAVE_FAILED");
      }
    },
    onSuccess: (_data, patch) => {
      void queryClient.invalidateQueries({ queryKey: PROFILE_INFO_QUERY_KEY });
      // Header-ийн профайл таб нэр, зургийг кэшлэдэг.
      if (patch.fullName !== undefined || patch.avatarUrl !== undefined) {
        void queryClient.invalidateQueries({ queryKey: PROFILE_SUMMARY_KEY });
      }
    },
  });
}

/** Утас, имэйл, хаяг өөр урсгалаар солигдсоны дараа дахин уншуулна. */
export function useRefreshProfileInfo() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: PROFILE_INFO_QUERY_KEY });
}

export function useClaimProfileReward() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<number> => {
      const res = await fetch("/api/account/profile-info/reward", {
        method: "POST",
      });
      if (!res.ok) throw new Error("claim_failed");
      const data = (await res.json()) as { points?: number };
      return data.points ?? 0;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PROFILE_INFO_QUERY_KEY });
    },
  });
}

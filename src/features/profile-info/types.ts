import type { ProfileGender } from "@/lib/constants";

/** `/api/account/profile-info`-ийн хариу (0163, feature flag `profile_info`). */
export interface ProfileInfo {
  avatarUrl: string | null;
  fullName: string;
  phone: string;
  phoneVerified: boolean;
  /** Идэвхтэй имэйл бүртгэл (`newsletter_subscribers`); байхгүй бол null. */
  email: string | null;
  gender: ProfileGender | null;
  /** `YYYY-MM-DD`. */
  birthday: string | null;
  job: string;
  /** `scent_families.slug`-ууд. */
  scentPreferences: string[];
  favoritePerfumes: string[];
  address: {
    count: number;
    /** Үндсэн хаягийн нэг мөр. */
    summary: string | null;
  };
  reward: {
    /** Одоогийн тохиргоо (`settings.loyalty.profilePoints`); 0 = унтраалттай. */
    points: number;
    /** Авсан бол авсан оноо, үгүй бол null. */
    claimedPoints: number | null;
  };
}

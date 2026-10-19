import type { UserTierKey } from "@/lib/constants";
import type { LeaderboardPeriod } from "./lib";

/** Топ жагсаалтын нэг мөр. */
export interface LeaderboardEntry {
  rank: number;
  /** Сонгосон хугацаан дахь захиалгын дүн, ₮ (купоны дараах, хүргэлтгүй). */
  amount: number;
  name: string;
  avatarUrl: string | null;
  tier: UserTierKey;
  isMe: boolean;
}

export interface Leaderboard {
  top: LeaderboardEntry[];
  /** Топод ороогүй ч энэ хугацаанд худалдан авалт хийсэн бол өөрийн байр. */
  me: LeaderboardEntry | null;
}

export type Leaderboards = Record<LeaderboardPeriod, Leaderboard>;

/** `GET /api/account/tier` */
export interface TierSummary {
  /** Нийт худалдан авалт, ₮ (төлөгдсөн, цуцлагдаагүй, купоны дараах). */
  lifetimeSpend: number;
  tier: UserTierKey;
  me: { name: string | null; avatarUrl: string | null };
  leaderboards: Leaderboards;
}

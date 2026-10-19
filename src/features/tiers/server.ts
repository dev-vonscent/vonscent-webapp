import "server-only";
import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { TIER_LEADERBOARD_SIZE, type UserTierKey } from "@/lib/constants";
import { isSupabaseConfigured } from "@/lib/env";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { callRpc } from "@/lib/supabase/rpc";
import {
  LEADERBOARD_PERIODS,
  lifetimeSpendOf,
  displayName,
  periodRange,
  tierForSpend,
  type LeaderboardPeriod,
} from "./lib";
import type {
  Leaderboard,
  LeaderboardEntry,
  Leaderboards,
  TierSummary,
} from "./types";

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

/**
 * Хэрэглэгчийн route-ын хаалга: туг (404) → нэвтэрсэн (401) → service-role.
 * Түвшний RPC-ууд (0138) зөвхөн service_role-д нээлттэй.
 */
export async function tierUserGate() {
  if (!(await isFeatureEnabled("user_tiers"))) {
    return {
      response: NextResponse.json({ error: "NOT_FOUND" }, { status: 404 }),
    } as const;
  }
  if (!isSupabaseConfigured) {
    return {
      response: NextResponse.json({ error: "NO_DB" }, { status: 503 }),
    } as const;
  }
  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!user) {
    return {
      response: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }),
    } as const;
  }
  const admin = createAdminClient();
  if (!admin) {
    return {
      response: NextResponse.json({ error: "NO_DB" }, { status: 500 }),
    } as const;
  }
  return { admin, user } as const;
}

/** Нийт худалдан авалт, ₮ (`user_lifetime_spend`, 0138). */
export async function getLifetimeSpend(
  admin: AdminClient,
  userId: string,
): Promise<number> {
  const { data, error } = await callRpc<number | string>(
    admin,
    "user_lifetime_spend",
    { p_user: userId },
  );
  if (error) throw new Error(`user_lifetime_spend: ${error.message}`);
  // bigint нь PostgREST-ээс тоо эсвэл мөр болж ирж болно.
  return Number(data ?? 0);
}

interface LeaderboardRow {
  rank: number;
  full_name: string | null;
  avatar_url: string | null;
  period_spend: number | string;
  lifetime_spend: number | string;
  is_me: boolean;
}

/** Нэг хугацааны топ (+ `me` өгвөл өөрийн байр). */
async function getLeaderboard(
  admin: AdminClient,
  period: LeaderboardPeriod,
  me: { id: string } | null,
): Promise<Leaderboard> {
  const { from, to } = periodRange(period);
  const { data, error } = await callRpc<LeaderboardRow[]>(
    admin,
    "tier_leaderboard",
    {
      p_from: from.toISOString(),
      p_to: to.toISOString(),
      p_user: me?.id ?? null,
      p_limit: TIER_LEADERBOARD_SIZE,
    },
  );
  if (error) throw new Error(`tier_leaderboard: ${error.message}`);
  const entries: LeaderboardEntry[] = (data ?? []).map((r) => ({
    rank: r.rank,
    amount: Number(r.period_spend),
    name: displayName(r.full_name),
    avatarUrl: r.avatar_url,
    tier: tierForSpend(Number(r.lifetime_spend)).key,
    isMe: r.is_me,
  }));
  return {
    top: entries.filter((e) => e.rank <= TIER_LEADERBOARD_SIZE),
    me: entries.find((e) => e.isMe && e.rank > TIER_LEADERBOARD_SIZE) ?? null,
  };
}

async function getLeaderboards(
  admin: AdminClient,
  me: { id: string } | null,
): Promise<Leaderboards> {
  const [week, month, all] = await Promise.all(
    LEADERBOARD_PERIODS.map((p) => getLeaderboard(admin, p.key, me)),
  );
  return { week, month, all };
}

/**
 * Нүүр хуудасны топ 3 — хэн ч харна (нэр, зураг, дүнтэй). 5 минут кэшлэнэ
 * (нүүр хуудас ISR; хүсэлт бүрд 3 RPC явуулахгүй). Алдаа кэшлэгдэхгүй.
 */
export const getPublicLeaderboards = unstable_cache(
  async (): Promise<Leaderboards | null> => {
    const admin = createAdminClient();
    if (!admin) return null;
    return getLeaderboards(admin, null);
  },
  ["tier-public-leaderboards"],
  { revalidate: 300 },
);

export async function getTierSummary(
  admin: AdminClient,
  userId: string,
): Promise<TierSummary> {
  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("id", userId)
    .maybeSingle();
  const p = profile as {
    full_name?: string | null;
    avatar_url?: string | null;
  } | null;
  const myName = p?.full_name ?? null;
  const [lifetimeSpend, leaderboards] = await Promise.all([
    getLifetimeSpend(admin, userId),
    getLeaderboards(admin, { id: userId }),
  ]);
  return {
    lifetimeSpend,
    tier: tierForSpend(lifetimeSpend).key,
    me: { name: myName, avatarUrl: p?.avatar_url ?? null },
    leaderboards,
  };
}

/**
 * Олон хэрэглэгчийн түвшин нэг дор — сэтгэгдэл гэх мэт бусдын зураг
 * харагдах газарт хүрээ зурахад. Туг хаалттай бол хоосон (хүрээгүй).
 * Нийт дүн нь `user_lifetime_spend`-тэй ижил дүрмээр (`lifetimeSpendOf`).
 */
export async function getTiersForUsers(
  userIds: readonly string[],
): Promise<Record<string, UserTierKey>> {
  const ids = [...new Set(userIds)].filter(Boolean);
  if (ids.length === 0 || !(await isFeatureEnabled("user_tiers"))) return {};
  const admin = createAdminClient();
  if (!admin) return {};
  const { data, error } = await admin
    .from("orders")
    .select("user_id, payment_status, status, subtotal, discount")
    .in("user_id", ids)
    .eq("payment_status", "paid")
    .neq("status", "cancelled");
  if (error) {
    Sentry.captureException(new Error(`tiers for users: ${error.message}`));
    return {};
  }
  type Row = {
    user_id: string;
    payment_status: string;
    status: string;
    subtotal: number;
    discount: number | null;
  };
  const byUser = new Map<string, Row[]>();
  for (const r of (data as Row[] | null) ?? []) {
    byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r]);
  }
  return Object.fromEntries(
    ids.map((id) => [
      id,
      tierForSpend(lifetimeSpendOf(byUser.get(id) ?? [])).key,
    ]),
  );
}

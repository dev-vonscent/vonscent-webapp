import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { callRpc } from "@/lib/supabase/rpc";
import { notifyAdmin, tgEscape } from "@/lib/notify/telegram";
import type { CouponRow, SpinWheelSpinRow } from "@/db/types";
import type {
  MissTip,
  SpinHistoryItem,
  SpinHistoryPage,
  SpinMode,
  SpinOutcome,
  WheelPrize,
  WheelState,
} from "./types";

/** Shown while Supabase isn't configured (demo build) — the wheel is inert. */
const OFFLINE_STATE: WheelState = {
  enabled: false,
  prizes: [],
  spinCost: 0,
  freeSpinHours: 24,
  orderSpinStep: 0,
  orderSpins: 0,
  points: 0,
  nextFreeAt: null,
  freeReady: false,
  signedIn: false,
  history: [],
  hasMoreHistory: false,
  missTips: [],
};

/** Spins shown on the page itself; the rest open in the history dialog. */
const HISTORY_PREVIEW = 5;
/** Page size of the full history. */
export const HISTORY_PAGE = 30;

/** The signed-in customer, or null. Never trust an id sent by the client. */
async function currentUserId(): Promise<string | null> {
  const session = await createClient();
  if (!session) return null;
  const {
    data: { user },
  } = await session.auth.getUser();
  return user?.id ?? null;
}

/** `limit` rows from `offset`, newest first (id breaks same-instant ties). */
async function readHistory(
  supabase: NonNullable<ReturnType<typeof createAdminClient>>,
  userId: string,
  offset: number,
  limit: number,
): Promise<SpinHistoryItem[]> {
  const { data } = await supabase
    .from("spin_wheel_spins")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + limit - 1);
  const rows = (data as SpinWheelSpinRow[] | null) ?? [];

  // Coupon codes come from a second read rather than an embedded join: a
  // page is at most HISTORY_PAGE rows, and this stays independent of how
  // PostgREST happens to name the coupons relationship.
  const couponIds = rows
    .map((r) => r.coupon_id)
    .filter((id): id is string => !!id);
  const coupons = new Map<
    string,
    Pick<CouponRow, "code" | "is_active" | "ends_at">
  >();
  if (couponIds.length > 0) {
    const { data: cs } = await supabase
      .from("coupons")
      .select("id, code, is_active, ends_at")
      .in("id", couponIds);
    for (const c of (cs as (CouponRow & { id: string })[] | null) ?? []) {
      coupons.set(c.id, c);
    }
  }

  return rows.map((r) => {
    const coupon = r.coupon_id ? coupons.get(r.coupon_id) : undefined;
    const expired =
      coupon?.ends_at != null && new Date(coupon.ends_at) < new Date();
    return {
      id: r.id,
      label: r.label,
      kind: r.kind,
      tier: r.tier,
      value: r.value,
      spinType: r.spin_type,
      couponCode: coupon?.code ?? null,
      couponActive: !!coupon?.is_active && !expired,
      createdAt: r.created_at,
    };
  });
}

/**
 * Everything the wheel page renders. Guests get the segments and the rules but
 * no balance — `spin_wheel_state` is a security-definer function, so it is
 * called with the service role and the *server's* idea of who is signed in.
 */
export async function getWheelState(): Promise<WheelState> {
  if (!isSupabaseConfigured) return OFFLINE_STATE;
  const supabase = createAdminClient();
  if (!supabase) return OFFLINE_STATE;

  const userId = await currentUserId();
  const [{ data, error }, missTips] = await Promise.all([
    callRpc<Omit<WheelState, "history" | "hasMoreHistory" | "missTips">>(
      supabase,
      "spin_wheel_state",
      { p_user: userId },
    ),
    readMissTips(supabase),
  ]);
  if (error || !data) return OFFLINE_STATE;

  // One row past the preview tells whether the "see all" button has anything
  // to show, without a separate count query.
  const recent = userId
    ? await readHistory(supabase, userId, 0, HISTORY_PREVIEW + 1)
    : [];
  return {
    ...data,
    prizes: (data.prizes ?? []) as WheelPrize[],
    history: recent.slice(0, HISTORY_PREVIEW),
    hasMoreHistory: recent.length > HISTORY_PREVIEW,
    missTips,
  };
}

/**
 * The «Хоосон» card's tips (0170, `settings.spin.missTips`) — public shop
 * copy, unlike the weights in the same row's neighbours. Malformed entries
 * are dropped rather than shown half-empty.
 */
async function readMissTips(
  supabase: NonNullable<ReturnType<typeof createAdminClient>>,
): Promise<MissTip[]> {
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "spin")
    .maybeSingle();
  const raw = (data?.value as { missTips?: unknown } | null)?.missTips;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (t): t is MissTip =>
      !!t &&
      typeof t.title === "string" &&
      typeof t.body === "string" &&
      t.body.trim() !== "",
  );
}

/**
 * One page of the signed-in customer's full spin history, or null for a
 * guest. Fetches a row past the page to know whether another one follows.
 */
export async function getSpinHistory(
  offset: number,
): Promise<SpinHistoryPage | null> {
  if (!isSupabaseConfigured) return { items: [], nextOffset: null };
  const supabase = createAdminClient();
  if (!supabase) return { items: [], nextOffset: null };

  const userId = await currentUserId();
  if (!userId) return null;

  const rows = await readHistory(supabase, userId, offset, HISTORY_PAGE + 1);
  return {
    items: rows.slice(0, HISTORY_PAGE),
    nextOffset: rows.length > HISTORY_PAGE ? offset + HISTORY_PAGE : null,
  };
}

/**
 * One spin. Entitlement (free / order credit / points), the weighted draw and
 * the award all happen inside `spin_wheel()` under a row lock — this function
 * only decides *who* is spinning (docs/lucky-wheel.md §6: the odds never reach the client).
 */
export async function spinWheel(mode: SpinMode): Promise<SpinOutcome> {
  if (!isSupabaseConfigured) return { ok: false, reason: "NO_DB" };
  const supabase = createAdminClient();
  if (!supabase) return { ok: false, reason: "NO_DB" };

  const userId = await currentUserId();
  if (!userId) return { ok: false, reason: "AUTH" };

  const { data, error } = await callRpc<SpinOutcome>(supabase, "spin_wheel", {
    p_user: userId,
    p_mode: mode,
  });
  if (error || !data) return { ok: false, reason: "NO_DB" };

  // A physical prize (grand bundle 0165, product 0170): tell the shop straight
  // away — a real parcel is now owed. The in-app bell for staff is written by
  // the spin's trigger.
  if (data.ok && (data.kind === "bundle" || data.kind === "product")) {
    await notifyPhysicalWin(supabase, userId, data.label, data.kind);
  }
  return data;
}

/** Telegram to the shop on a physical win. Best-effort: never fails the spin. */
async function notifyPhysicalWin(
  supabase: NonNullable<ReturnType<typeof createAdminClient>>,
  userId: string,
  label: string,
  kind: "bundle" | "product",
): Promise<void> {
  try {
    const { data } = await supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("id", userId)
      .maybeSingle();
    const p = data as { full_name: string | null; phone: string | null } | null;
    await notifyAdmin(
      `🏆 <b>Азын хүрд — ${kind === "bundle" ? "гранд шагнал" : "бодит шагнал"}</b>\n` +
        `${tgEscape(label)}\n` +
        `👤 ${tgEscape(p?.full_name?.trim() || "Хэрэглэгч")} · ${tgEscape(p?.phone ?? "—")}\n` +
        (kind === "bundle"
          ? `Хэрэглэгч багцаа сонгоод дараагийн захиалгадаа авна.`
          : `Дараагийн захиалгад нь 0₮-өөр хавсарна.`),
    );
  } catch {
    // Telegram is a nicety; the admin page and bell carry the same news.
  }
}

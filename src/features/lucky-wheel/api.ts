import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { callRpc } from "@/lib/supabase/rpc";
import type { CouponRow, SpinWheelSpinRow } from "@/db/types";
import type {
  SpinHistoryItem,
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
  points: 0,
  nextFreeAt: null,
  freeReady: false,
  signedIn: false,
  history: [],
};

const HISTORY_LIMIT = 12;

/** The signed-in customer, or null. Never trust an id sent by the client. */
async function currentUserId(): Promise<string | null> {
  const session = await createClient();
  if (!session) return null;
  const {
    data: { user },
  } = await session.auth.getUser();
  return user?.id ?? null;
}

async function readHistory(
  supabase: NonNullable<ReturnType<typeof createAdminClient>>,
  userId: string,
): Promise<SpinHistoryItem[]> {
  const { data } = await supabase
    .from("spin_wheel_spins")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);
  const rows = (data as SpinWheelSpinRow[] | null) ?? [];

  // Coupon codes come from a second read rather than an embedded join: the
  // history is capped at a dozen rows, and this stays independent of how
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
  const { data, error } = await callRpc<Omit<WheelState, "history">>(
    supabase,
    "spin_wheel_state",
    { p_user: userId },
  );
  if (error || !data) return OFFLINE_STATE;

  return {
    ...data,
    prizes: (data.prizes ?? []) as WheelPrize[],
    history: userId ? await readHistory(supabase, userId) : [],
  };
}

/**
 * One spin. Entitlement, the weighted draw, the monthly caps and the award all
 * happen inside `spin_wheel()` under a row lock — this function only decides
 * *who* is spinning (docs/lucky-wheel.md §6: the odds never reach the client).
 */
export async function spinWheel(paid: boolean): Promise<SpinOutcome> {
  if (!isSupabaseConfigured) return { ok: false, reason: "NO_DB" };
  const supabase = createAdminClient();
  if (!supabase) return { ok: false, reason: "NO_DB" };

  const userId = await currentUserId();
  if (!userId) return { ok: false, reason: "AUTH" };

  const { data, error } = await callRpc<SpinOutcome>(supabase, "spin_wheel", {
    p_user: userId,
    p_paid: paid,
  });
  if (error || !data) return { ok: false, reason: "NO_DB" };
  return data;
}

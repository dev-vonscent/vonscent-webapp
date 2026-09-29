import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { maskName, maskPhone } from "@/lib/mask";
import {
  toWalletCoupon,
  type CouponRecord,
  type WalletCoupon,
  type WalletRedemption,
} from "./components/coupons";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

const COLUMNS =
  "id, code, type, value, min_subtotal, max_discount, ends_at, max_uses, used_count, is_active, source";

/** Enough for years of wheel spins; the wallet is not paginated. */
const WALLET_LIMIT = 200;

/**
 * The signed-in customer's coupons with who used each one (0104).
 *
 * Read with the admin client: a shared coupon's redemption row belongs to the
 * FRIEND who used it, so RLS (`coupon_redemptions.user_id = auth.uid()`) would
 * hide it from the owner. That is exactly why the redeemer is masked here —
 * their id, full name and phone never leave the server.
 *
 * `code` narrows to one coupon (the detail page). Ownership is always part of
 * the query, so another customer's code simply returns nothing.
 */
export async function loadWallet(
  supabase: Admin,
  userId: string,
  code?: string,
): Promise<WalletCoupon[]> {
  let query = supabase
    .from("coupons")
    .select(COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(WALLET_LIMIT);
  // Codes are stored uppercase (admin route, generate_coupon_code).
  if (code) query = query.eq("code", code.toUpperCase());
  const { data } = await query;
  const rows = (data as CouponRecord[] | null) ?? [];
  if (rows.length === 0) return [];

  // Cancelled orders gave the coupon back; they are the admin's log, not a use.
  const { data: reds } = await supabase
    .from("coupon_redemptions")
    .select("coupon_id, user_id, created_at")
    .in(
      "coupon_id",
      rows.map((r) => r.id),
    )
    .is("cancelled_at", null);
  const redemptions =
    (reds as
      | { coupon_id: string; user_id: string | null; created_at: string }[]
      | null) ?? [];

  const others = [
    ...new Set(
      redemptions
        .map((r) => r.user_id)
        .filter((id): id is string => !!id && id !== userId),
    ),
  ];
  const people = new Map<
    string,
    { full_name: string | null; phone: string | null }
  >();
  if (others.length > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name, phone")
      .in("id", others);
    for (const p of (profs as
      | { id: string; full_name: string | null; phone: string | null }[]
      | null) ?? []) {
      people.set(p.id, p);
    }
  }

  const byCoupon = new Map<string, WalletRedemption[]>();
  for (const r of redemptions) {
    const person = r.user_id ? people.get(r.user_id) : undefined;
    const entry: WalletRedemption = {
      by:
        r.user_id === userId
          ? "self"
          : {
              name: maskName(person?.full_name),
              phone: maskPhone(person?.phone),
            },
      at: r.created_at,
    };
    byCoupon.set(r.coupon_id, [...(byCoupon.get(r.coupon_id) ?? []), entry]);
  }

  const now = Date.now();
  return rows.map((c) => toWalletCoupon(c, byCoupon.get(c.id) ?? [], now));
}

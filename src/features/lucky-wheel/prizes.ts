import "server-only";
import { getBaseCollections } from "@/features/collections/api";
import { GRAND_BUNDLE_ML } from "@/lib/constants";
import type { createAdminClient } from "@/lib/supabase/admin";
import { grandPrizeState } from "./prize-state";
import type {
  BundleGender,
  GrandBundleOption,
  GrandPrize,
  GrandPrizesResponse,
} from "./types";

/**
 * Азын хүрдний гранд шагнал — 2мл багц (0165).
 *
 * Хожих → `spin_wheel()` + trigger (хугацаа, мэдэгдэл).
 * Сонгох → `chooseGrandBundle` (энд): админы санал болгосон 2 багцаас.
 * Авах → `place_order_with_prize` (захиалгын route), хүргэгдэх/цуцлагдах нь
 * захиалгын trigger-ээр. Энэ файл зөвхөн уншиж, сонголтыг бичнэ.
 */

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

export interface GrandBundleSettings {
  male: string | null;
  female: string | null;
}

/** `settings.spin.grandBundles` / `bundleClaimDays`, with safe defaults. */
export async function readGrandSettings(admin: AdminClient): Promise<{
  bundles: GrandBundleSettings;
  claimDays: number;
}> {
  const { data } = await admin
    .from("settings")
    .select("value")
    .eq("key", "spin")
    .maybeSingle();
  const value = (data?.value ?? {}) as {
    grandBundles?: Partial<GrandBundleSettings>;
    bundleClaimDays?: number;
  };
  return {
    bundles: {
      male: value.grandBundles?.male ?? null,
      female: value.grandBundles?.female ?? null,
    },
    claimDays:
      Number(value.bundleClaimDays) > 0 ? Number(value.bundleClaimDays) : 60,
  };
}

/**
 * The two bundles on offer, resolved against live stock: a bundle is only
 * `available` when every member can be poured at 2ml right now (inventory and
 * the bottle lock — `availableMls`, collections/api.ts).
 */
export async function getGrandOptions(
  bundles: GrandBundleSettings,
): Promise<GrandBundleOption[]> {
  const collections = await getBaseCollections();
  const byId = new Map(collections.map((c) => [c.id, c]));
  const out: GrandBundleOption[] = [];
  for (const gender of ["male", "female"] as const) {
    const id = bundles[gender];
    const c = id ? byId.get(id) : undefined;
    if (!c) continue;
    out.push({
      gender,
      collectionId: c.id,
      name: c.name,
      image: c.image,
      members: c.members.map((m) => ({ name: m.name, brand: m.brand })),
      available: c.availableMls.includes(GRAND_BUNDLE_ML),
      value: c.prices.find((p) => p.ml === GRAND_BUNDLE_ML)?.price ?? 0,
    });
  }
  return out;
}

interface PrizeRow {
  id: string;
  label: string;
  created_at: string;
  expires_at: string | null;
  bundle_collection_id: string | null;
  bundle_gender: BundleGender | null;
  claim_order_id: string | null;
  fulfilled_at: string | null;
  collections: { name: string } | null;
  orders: { order_no: string } | null;
}

/** Every grand prize the customer has won, newest first. */
export async function getMyGrandPrizes(
  admin: AdminClient,
  userId: string,
): Promise<GrandPrize[]> {
  const { data, error } = await admin
    .from("spin_wheel_spins")
    .select(
      "id, label, created_at, expires_at, bundle_collection_id, bundle_gender, claim_order_id, fulfilled_at, collections:bundle_collection_id(name), orders:claim_order_id(order_no)",
    )
    .eq("user_id", userId)
    .eq("kind", "bundle")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(`grand prizes: ${error.message}`);
  const now = new Date();
  return ((data ?? []) as unknown as PrizeRow[]).map((r) => ({
    spinId: r.id,
    label: r.label,
    wonAt: r.created_at,
    expiresAt: r.expires_at,
    state: grandPrizeState(r, now),
    gender: r.bundle_gender,
    bundleName: r.collections?.name ?? null,
    orderNo: r.orders?.order_no ?? null,
  }));
}

export async function getGrandPrizesResponse(
  admin: AdminClient,
  userId: string,
): Promise<GrandPrizesResponse> {
  const [{ bundles }, prizes] = await Promise.all([
    readGrandSettings(admin),
    getMyGrandPrizes(admin, userId),
  ]);
  return { prizes, options: await getGrandOptions(bundles) };
}

export type ChooseResult =
  | { ok: true }
  | {
      ok: false;
      reason: "NOT_FOUND" | "LOCKED" | "EXPIRED" | "NO_OPTION" | "SOLD_OUT";
    };

/**
 * Pick (or change) the bundle for a won grand prize. Allowed until the prize
 * goes into an order; the bundle must be one of today's two and pourable at
 * 2ml. Stock is not held here — it is reserved when the order is placed, so a
 * prize parked for weeks never blocks the shelf.
 */
export async function chooseGrandBundle(
  admin: AdminClient,
  userId: string,
  spinId: string,
  gender: BundleGender,
): Promise<ChooseResult> {
  const { data: spin } = await admin
    .from("spin_wheel_spins")
    .select("id, user_id, kind, claim_order_id, fulfilled_at, expires_at")
    .eq("id", spinId)
    .maybeSingle();
  const row = spin as {
    user_id: string;
    kind: string;
    claim_order_id: string | null;
    fulfilled_at: string | null;
    expires_at: string | null;
  } | null;
  if (!row || row.user_id !== userId || row.kind !== "bundle") {
    return { ok: false, reason: "NOT_FOUND" };
  }
  if (row.claim_order_id || row.fulfilled_at) {
    return { ok: false, reason: "LOCKED" };
  }
  if (row.expires_at && new Date(row.expires_at) <= new Date()) {
    return { ok: false, reason: "EXPIRED" };
  }

  const { bundles } = await readGrandSettings(admin);
  const option = (await getGrandOptions(bundles)).find(
    (o) => o.gender === gender,
  );
  if (!option) return { ok: false, reason: "NO_OPTION" };
  if (!option.available) return { ok: false, reason: "SOLD_OUT" };

  // Guarded on the same conditions, so a prize that went into an order a
  // moment ago is not rewritten under it.
  const { data: updated, error } = await admin
    .from("spin_wheel_spins")
    .update({
      bundle_collection_id: option.collectionId,
      bundle_gender: gender,
      chosen_at: new Date().toISOString(),
    })
    .eq("id", spinId)
    .eq("user_id", userId)
    .is("claim_order_id", null)
    .is("fulfilled_at", null)
    .select("id");
  if (error) throw new Error(`choose grand bundle: ${error.message}`);
  if (!updated?.length) return { ok: false, reason: "LOCKED" };

  await admin.from("admin_notifications").insert({
    kind: "spin_grand",
    message: `Азын хүрд: гранд шагналын багц сонгов — «${option.name}»`,
  });
  return { ok: true };
}

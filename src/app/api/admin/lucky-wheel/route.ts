import { NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffUser } from "@/lib/auth/guard";

/**
 * Азын хүрдний админ бичилт (docs/lucky-wheel.md §5 таг №6: "магадлал, таг
 * бүр админаас тохируулагдана — код дотор хатуу бичихгүй").
 *
 *   PUT   → segments and/or the `settings.spin` tunables
 *   PATCH → a grand prize by hand: mark it delivered, or give an expired
 *           one 14 more days (0165)
 *
 * Reads live in `getWheelAdmin()`; this file only writes.
 */

const prizeSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1).max(60),
  shortLabel: z.string().max(24),
  value: z.number().int().min(0),
  minSubtotal: z.number().int().min(0),
  maxDiscount: z.number().int().positive().nullable(),
  weight: z.number().min(0).max(1000),
  monthlyCap: z.number().int().min(0).nullable(),
  fallbackSlot: z.number().int().min(1).max(40).nullable(),
  isActive: z.boolean(),
});

const settingsSchema = z.object({
  enabled: z.boolean(),
  freeSpinHours: z
    .number()
    .int()
    .min(1)
    .max(24 * 30),
  spinCost: z.number().int().min(0),
  orderSpinStep: z.number().int().min(0),
  monthlyPointCap: z.number().int().min(0),
  rareCouponPerMonth: z.number().int().min(0),
  couponValidDays: z.number().int().min(1).max(365),
  singleActiveCoupon: z.boolean(),
  // Гранд шагнал (0165): хоёр багц ба авах хугацаа.
  grandBundles: z.object({
    male: z.string().uuid().nullable(),
    female: z.string().uuid().nullable(),
  }),
  bundleClaimDays: z.number().int().min(1).max(365),
});

const putSchema = z
  .object({
    prizes: z.array(prizeSchema).max(40).optional(),
    settings: settingsSchema.optional(),
  })
  .refine((v) => v.prizes || v.settings, { message: "EMPTY" });

async function requireStaff() {
  if (!isSupabaseConfigured) return { demo: true } as const;
  const staff = await getStaffUser();
  if (!staff) return { error: "FORBIDDEN", status: 403 } as const;
  const supabase = createAdminClient();
  if (!supabase) return { error: "NO_DB", status: 500 } as const;
  return { supabase } as const;
}

export async function PUT(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }

  const gate = await requireStaff();
  if ("demo" in gate) return NextResponse.json({ demo: true });
  if ("error" in gate) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  const { supabase } = gate;

  // Гранд шагнал (0165): эрэгтэй шагналд эрэгтэй/unisex, эмэгтэйд
  // эмэгтэй/unisex идэвхтэй бэлэн багц л — UI шүүсэн ч энд дахин шалгана.
  const grand = parsed.data.settings?.grandBundles;
  for (const gender of ["male", "female"] as const) {
    const id = grand?.[gender];
    if (!id) continue;
    const { data: coll } = await supabase
      .from("collections")
      .select("gender, type, is_active")
      .eq("id", id)
      .maybeSingle();
    const c = coll as {
      gender: string;
      type: string;
      is_active: boolean;
    } | null;
    if (
      !c ||
      c.type !== "base" ||
      !c.is_active ||
      (c.gender !== gender && c.gender !== "unisex")
    ) {
      return NextResponse.json(
        { error: "GRAND_BUNDLE_INVALID" },
        { status: 400 },
      );
    }
  }

  if (parsed.data.settings) {
    const { error } = await supabase
      .from("settings")
      .upsert({ key: "spin", value: parsed.data.settings });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // Updated one by one rather than upserted as a batch: `slot` is unique and
  // an upsert keyed on `id` would happily write a duplicate slot on a bad
  // payload. 26 rows today (40 at most), so the round trips are cheap.
  for (const prize of parsed.data.prizes ?? []) {
    const { error } = await supabase
      .from("spin_wheel_prizes")
      .update({
        label: prize.label,
        short_label: prize.shortLabel,
        value: prize.value,
        min_subtotal: prize.minSubtotal,
        max_discount: prize.maxDiscount,
        weight: prize.weight,
        monthly_cap: prize.monthlyCap,
        fallback_slot: prize.fallbackSlot,
        is_active: prize.isActive,
      })
      .eq("id", prize.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}

const patchSchema = z.union([
  z.object({ spinId: z.string().uuid(), fulfilled: z.boolean() }),
  z.object({ spinId: z.string().uuid(), extend: z.literal(true) }),
]);

/** Days an «extend» adds — enough for one more order cycle. */
const EXTEND_DAYS = 14;

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }

  const gate = await requireStaff();
  if ("demo" in gate) return NextResponse.json({ demo: true });
  if ("error" in gate) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  // Only grand prizes are handed over by hand, and only while not already
  // riding in an order (the order's own status settles those).
  const update =
    "extend" in parsed.data
      ? {
          expires_at: new Date(
            Date.now() + EXTEND_DAYS * 86_400_000,
          ).toISOString(),
        }
      : {
          fulfilled_at: parsed.data.fulfilled ? new Date().toISOString() : null,
        };
  const { error } = await gate.supabase
    .from("spin_wheel_spins")
    .update(update)
    .eq("id", parsed.data.spinId)
    .eq("kind", "bundle")
    .is("claim_order_id", null);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

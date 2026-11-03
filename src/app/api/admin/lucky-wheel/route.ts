import { NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { callRpc } from "@/lib/supabase/rpc";
import { getStaffUser } from "@/lib/auth/guard";
import { ML_SIZES } from "@/lib/constants";

/**
 * Азын хүрдний админ бичилт (docs/lucky-wheel.md §5 таг №6: "магадлал, таг
 * бүр админаас тохируулагдана — код дотор хатуу бичихгүй").
 *
 *   PUT   → the whole wheel (added, removed, reordered — 0170) and/or the
 *           `settings.spin` tunables
 *   PATCH → a physical prize by hand: mark it delivered, or give an expired
 *           one 14 more days (0165)
 *
 * Reads live in `getWheelAdmin()`; this file only writes.
 */

/**
 * One wedge, in wheel order. No `id` = a new prize. `weight` is the chance in
 * percent (the wheel draws relative to the total, so 100 is a convention the
 * admin page checks, not a rule). Each kind needs its own fields.
 */
const prizeSchema = z
  .object({
    id: z.string().uuid().nullable(),
    kind: z.enum([
      "none",
      "points",
      "coupon_percent",
      "coupon_fixed",
      "product",
      "bundle",
    ]),
    tier: z.enum(["common", "rare", "grand"]),
    label: z.string().trim().min(1).max(60),
    shortLabel: z.string().trim().max(24),
    value: z.number().int().min(0),
    minSubtotal: z.number().int().min(0),
    maxDiscount: z.number().int().positive().nullable(),
    weight: z.number().min(0).max(100),
    monthlyCap: z.number().int().min(0).nullable(),
    productId: z.string().uuid().nullable(),
    ml: z
      .number()
      .int()
      .refine((n) => (ML_SIZES as readonly number[]).includes(n))
      .nullable(),
  })
  .superRefine((p, ctx) => {
    const need = (ok: boolean, message: string) => {
      if (!ok) ctx.addIssue({ code: "custom", message });
    };
    if (p.kind === "points" || p.kind === "coupon_fixed") {
      need(p.value > 0, "VALUE_REQUIRED");
    }
    if (p.kind === "coupon_percent") {
      need(p.value > 0 && p.value <= 100, "PERCENT_RANGE");
    }
    if (p.kind === "product") {
      need(!!p.productId && !!p.ml, "PRODUCT_REQUIRED");
    }
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
  // «Хоосон»-ий зөвлөгөө (0170).
  missTips: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(80),
        body: z.string().trim().min(1).max(400),
      }),
    )
    .max(20),
});

const putSchema = z
  .object({
    prizes: z.array(prizeSchema).min(2).max(40).optional(),
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

  // One transaction (0170): adds, removes and reorders together — `slot` is
  // unique, checked at commit, so a reorder never trips over itself.
  if (parsed.data.prizes) {
    const { error } = await callRpc(supabase, "admin_save_spin_prizes", {
      p_prizes: parsed.data.prizes,
    });
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
    .in("kind", ["bundle", "product"])
    .is("claim_order_id", null);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

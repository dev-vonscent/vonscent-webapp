import { NextResponse } from "next/server";
import { revalidatePublic } from "@/lib/cache";
import { isSupabaseConfigured } from "@/lib/env";
import { getStaffUser } from "@/lib/auth/guard";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { createAdminClient } from "@/lib/supabase/admin";
import { bulkSaleSchema, clearSaleSchema } from "@/lib/validators/sale";

export const dynamic = "force-dynamic";

/** Туг (404) → staff (403) → service-role. RPC нь туг дахин шалгана (0166). */
async function guard() {
  if (!(await isFeatureEnabled("sale_page"))) {
    return {
      response: NextResponse.json({ error: "NOT_FOUND" }, { status: 404 }),
    };
  }
  if (!isSupabaseConfigured)
    return { response: NextResponse.json({ demo: true }) };
  const staff = await getStaffUser();
  if (!staff) {
    return {
      response: NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }),
    };
  }
  const supabase = createAdminClient();
  if (!supabase) {
    return {
      response: NextResponse.json({ error: "NO_DB" }, { status: 500 }),
    };
  }
  return { supabase };
}

const failed = () =>
  NextResponse.json(
    { error: "Хадгалж чадсангүй. Дахин оролдоно уу." },
    { status: 500 },
  );

/** Сонгосон бараануудад хугацаатай хямдрал тавина (`apply_bulk_sale`). */
export async function POST(req: Request) {
  const parsed = bulkSaleSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Буруу хүсэлт." },
      { status: 400 },
    );
  }
  const g = await guard();
  if ("response" in g) return g.response;

  const { productIds, pcts, startsAt, endsAt } = parsed.data;
  const { data, error } = await g.supabase.rpc("apply_bulk_sale", {
    p_product_ids: productIds,
    p_pcts: pcts,
    p_starts: startsAt,
    p_ends: endsAt,
  });
  if (error) return failed();
  revalidatePublic();
  return NextResponse.json({ updated: data as number });
}

/** Сонгосон бараануудын хямдралыг цуцална (`clear_bulk_sale`). */
export async function DELETE(req: Request) {
  const parsed = clearSaleSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Буруу хүсэлт." }, { status: 400 });
  }
  const g = await guard();
  if ("response" in g) return g.response;

  const { data, error } = await g.supabase.rpc("clear_bulk_sale", {
    p_product_ids: parsed.data.productIds,
  });
  if (error) return failed();
  revalidatePublic();
  return NextResponse.json({ cleared: data as number });
}

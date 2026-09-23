import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePublic } from "@/lib/cache";
import { ML_SIZES } from "@/lib/constants";
import { isSupabaseConfigured } from "@/lib/env";
import { getStaffUser } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Нэг бараа/хэмжээг савны түгжээнээс чөлөөлөх (0095).
 *
 * Ховор тохиолдолд «эрэгтэй үнэрийг unisex саванд хийж явуулъя» гэж админ
 * шийддэг. Түгжээг бүхэлд нь нээвэл тэр өнгийн БҮХ бараа нээгдэх тул ганц
 * мөрийн зөвшөөрөл өгнө. Сав ирээд түгжээ нээгдэхэд savны нөөцийн хуудас
 * эдгээрийг цуцлахыг санал болгоно.
 */
const schema = z.object({
  ml: z
    .number()
    .int()
    .refine((v) => (ML_SIZES as readonly number[]).includes(v)),
  override: z.boolean(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }
  if (!isSupabaseConfigured) return NextResponse.json({ demo: true });

  const staff = await getStaffUser();
  if (!staff) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: "NO_DB" }, { status: 500 });

  const { error } = await supabase
    .from("product_variants")
    .update({ bottle_override: parsed.data.override })
    .eq("product_id", id)
    .eq("ml", parsed.data.ml);

  if (error) {
    // 42703 = bottle_override багана байхгүй — 0095 ажиллаагүй.
    if ((error as { code?: string }).code === "42703") {
      return NextResponse.json({ error: "NOT_MIGRATED" }, { status: 503 });
    }
    return NextResponse.json({ error: "UPDATE_FAILED" }, { status: 500 });
  }

  revalidatePublic();
  return NextResponse.json({ ok: true });
}

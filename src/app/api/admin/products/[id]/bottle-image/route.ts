import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePublic } from "@/lib/cache";
import { BOTTLE_STYLES } from "@/lib/constants";
import { isSupabaseConfigured } from "@/lib/env";
import { getStaffUser } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { replaceBottleImage } from "@/features/admin/bottle-image";

/**
 * Засах хуудаснаас галерейн савны зургийг солих (`style`) эсвэл хасах (null).
 * Үүсгэх үед `bottleStyle`-ээр нэмдэгтэй ижил эх хувиас хуулна.
 */
const schema = z.object({ style: z.enum(BOTTLE_STYLES).nullable() });

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }
  if (!isSupabaseConfigured) return NextResponse.json({ demo: true });

  const staff = await getStaffUser();
  if (!staff) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: "NO_DB" }, { status: 500 });

  const { data } = await supabase
    .from("products")
    .select("slug")
    .eq("id", id)
    .maybeSingle();
  const product = data as { slug: string } | null;
  if (!product) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const ok = await replaceBottleImage(
    supabase,
    id,
    product.slug,
    parsed.data.style,
  );
  if (!ok) {
    return NextResponse.json({ error: "UPDATE_FAILED" }, { status: 500 });
  }
  revalidatePublic();
  return NextResponse.json({ ok: true });
}

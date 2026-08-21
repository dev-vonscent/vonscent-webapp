import { NextResponse } from "next/server";
import { revalidatePublic } from "@/lib/cache";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffUser } from "@/lib/auth/guard";
import { addGalleryImage } from "@/features/admin/image-gen";

/** Approve the latest generated image: publish it + activate the product (§5b). */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isSupabaseConfigured) return NextResponse.json({ demo: true });
  const staff = await getStaffUser();
  if (!staff) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: "NO_DB" }, { status: 500 });

  const { data: job } = await supabase
    .from("product_image_generations")
    .select("result_url")
    .eq("product_id", id)
    .eq("status", "done")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const url = (job as { result_url: string | null } | null)?.result_url;
  if (!url) return NextResponse.json({ error: "NO_IMAGE" }, { status: 400 });

  await addGalleryImage(supabase, id, url);
  await supabase.from("products").update({ is_active: true }).eq("id", id);

  revalidatePublic();
  return NextResponse.json({ ok: true });
}

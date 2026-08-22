import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePublic } from "@/lib/cache";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffUser } from "@/lib/auth/guard";
import { addGalleryImage } from "@/features/admin/image-gen";

const schema = z.object({ generationId: z.string().min(1) });

/** Revert the published image to an earlier generated version (history, §14.5). */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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

  const { data: gen } = await supabase
    .from("product_image_generations")
    .select("result_url")
    .eq("id", parsed.data.generationId)
    .eq("product_id", id)
    .eq("status", "done")
    .maybeSingle();
  const url = (gen as { result_url: string | null } | null)?.result_url;
  if (!url) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  await addGalleryImage(supabase, id, url);
  revalidatePublic();
  return NextResponse.json({ ok: true });
}

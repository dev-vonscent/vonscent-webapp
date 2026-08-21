import { NextResponse, after } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured, isImageGenConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffUser } from "@/lib/auth/guard";
import { processGeneration } from "@/lib/ai/process-generation";

const schema = z.object({
  prompt: z.string().min(1).max(4000),
  referenceUrl: z.string().url().nullable().optional(),
});

/** Start a fresh generation with an edited prompt (popup «дахин үүсгэх», §9). */
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
  if (!isSupabaseConfigured || !isImageGenConfigured) {
    return NextResponse.json({ error: "UNAVAILABLE" }, { status: 503 });
  }
  const staff = await getStaffUser();
  if (!staff) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: "NO_DB" }, { status: 500 });

  // Reuse the latest reference when the caller didn't send a new one.
  let referenceUrl = parsed.data.referenceUrl ?? null;
  if (referenceUrl === undefined || referenceUrl === null) {
    const { data: last } = await supabase
      .from("product_image_generations")
      .select("reference_url")
      .eq("product_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    referenceUrl =
      (last as { reference_url: string | null } | null)?.reference_url ?? null;
  }

  const { data: job, error } = await supabase
    .from("product_image_generations")
    .insert({
      product_id: id,
      status: "pending",
      prompt: parsed.data.prompt,
      reference_url: referenceUrl,
    })
    .select("id")
    .single();
  if (error || !job) {
    return NextResponse.json({ error: "ENQUEUE_FAILED" }, { status: 500 });
  }

  const jobId = (job as { id: string }).id;
  after(async () => {
    await processGeneration(jobId);
  });
  return NextResponse.json({ jobId });
}

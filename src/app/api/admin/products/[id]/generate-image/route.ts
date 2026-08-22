import { NextResponse, after } from "next/server";
import { isSupabaseConfigured, isImageGenConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffUser } from "@/lib/auth/guard";
import { processGeneration } from "@/lib/ai/process-generation";

/** Retry the product's latest generation job (table «дахин оролдох» on failure). */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isSupabaseConfigured || !isImageGenConfigured) {
    return NextResponse.json({ error: "UNAVAILABLE" }, { status: 503 });
  }
  const staff = await getStaffUser();
  if (!staff) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: "NO_DB" }, { status: 500 });

  const { data: job } = await supabase
    .from("product_image_generations")
    .select("id, status")
    .eq("product_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!job) return NextResponse.json({ error: "NO_JOB" }, { status: 404 });

  const j = job as { id: string; status: string };
  if (j.status === "generating" || j.status === "done") {
    return NextResponse.json({ jobId: j.id }); // nothing to retry
  }
  // Reset a failed job to pending so processGeneration will pick it up.
  await supabase
    .from("product_image_generations")
    .update({ status: "pending", error: null })
    .eq("id", j.id);

  after(async () => {
    await processGeneration(j.id);
  });
  return NextResponse.json({ jobId: j.id });
}

import { NextResponse, after } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured, isImageGenConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffUser } from "@/lib/auth/guard";
import { processGeneration } from "@/lib/ai/process-generation";
import {
  buildImagePrompt,
  DEFAULT_BASE_PROMPT,
} from "@/lib/ai/build-image-prompt";

const schema = z.object({
  // Optional small tweak. Empty → regenerate from the reference image and the
  // current base prompt (build-image-prompt.ts) alone.
  adjust: z.string().max(2000).optional(),
  // First generation for a product with no saved reference may seed one.
  referenceUrl: z.string().url().nullable().optional(),
});

interface ProductRow {
  name: string;
  brand: string | null;
  gender: string | null;
  scent_families: string[] | null;
  short_description: string | null;
  description: string | null;
  reference_image_url: string | null;
}

/** Start a fresh generation (popup «дахин үүсгэх», §9). The prompt is always
 * rebuilt server-side from the product + the current base prompt in the file,
 * so editing that file immediately affects new generations. An empty `adjust`
 * regenerates the same scene; a non-empty one appends a small adjustment. */
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

  const { data: product } = await supabase
    .from("products")
    .select(
      "name, brand, gender, scent_families, short_description, description, reference_image_url",
    )
    .eq("id", id)
    .maybeSingle();
  if (!product) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  const p = product as ProductRow;

  // Rebuild the prompt from the product fields + the file's base prompt.
  let prompt = buildImagePrompt(
    {
      name: p.name,
      brand: p.brand ?? undefined,
      gender: p.gender ?? undefined,
      scentFamilies: p.scent_families ?? undefined,
      shortDescription: p.short_description ?? undefined,
      description: p.description ?? undefined,
    },
    DEFAULT_BASE_PROMPT,
  );
  const tweak = (parsed.data.adjust ?? "").trim();
  if (tweak) prompt = `${prompt}\n\nAdjustment: ${tweak}`;

  // Reference resolution: prefer the product's saved original reference (most
  // stable — avoids drift), then an older job's reference (AI products that
  // predate the column), then whatever the client sent (edit-page seed, or the
  // product's current image) so there is always a bottle to work from.
  let referenceUrl = p.reference_image_url ?? null;
  if (!referenceUrl) {
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
  if (!referenceUrl) referenceUrl = parsed.data.referenceUrl ?? null;

  const { data: job, error } = await supabase
    .from("product_image_generations")
    .insert({
      product_id: id,
      status: "pending",
      prompt,
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

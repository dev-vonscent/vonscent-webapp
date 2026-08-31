import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadImage } from "@/lib/storage/storage";
import { addGalleryImage } from "@/features/admin/image-gen";
import {
  generateProductImage,
  type ImageSize,
  type ImageQuality,
} from "./generate-image";

/**
 * Process one generation job: claim it, call OpenAI, upload the result, and mark
 * the job done/failed. Runs in the background (Next.js `after()`) with the
 * service-role client, so it has no user session. Idempotent — a job already
 * generating/done is skipped.
 */

interface JobRow {
  id: string;
  product_id: string;
  status: string;
  prompt: string;
  reference_url: string | null;
  attempts: number;
}

interface ImageGenSettings {
  size?: ImageSize;
  quality?: ImageQuality;
}

export async function processGeneration(jobId: string): Promise<void> {
  const supabase = createAdminClient();
  if (!supabase) return;

  const { data: job } = await supabase
    .from("product_image_generations")
    .select("id, product_id, status, prompt, reference_url, attempts")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return;
  const j = job as JobRow;
  if (j.status === "generating" || j.status === "done") return; // idempotent

  await supabase
    .from("product_image_generations")
    .update({ status: "generating", attempts: j.attempts + 1, error: null })
    .eq("id", jobId);

  try {
    const { data: setting } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "imageGen")
      .maybeSingle();
    const cfg = ((setting?.value as ImageGenSettings) ??
      {}) as ImageGenSettings;

    const { buffer, contentType, ext } = await generateProductImage({
      prompt: j.prompt,
      referenceUrl: j.reference_url,
      size: cfg.size,
      quality: cfg.quality,
    });

    const { data: prod } = await supabase
      .from("products")
      .select("slug")
      .eq("id", j.product_id)
      .maybeSingle();
    const slug = (prod as { slug?: string } | null)?.slug ?? j.product_id;

    const uploaded = await uploadImage(
      `products/${slug}/ai-${randomUUID()}.${ext}`,
      buffer,
      contentType,
    );
    if (!uploaded) throw new Error("Storage upload failed.");

    // The result is a gallery picture like any other, just not ticked for the
    // storefront yet (0049) — the admin selects it in the image studio. The job
    // row stays as the record of the attempt.
    await addGalleryImage(supabase, j.product_id, uploaded.url, false);

    await supabase
      .from("product_image_generations")
      .update({ status: "done", result_url: uploaded.url, error: null })
      .eq("id", jobId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase
      .from("product_image_generations")
      .update({ status: "failed", error: msg.slice(0, 500) })
      .eq("id", jobId);
  }
}

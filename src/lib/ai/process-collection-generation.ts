import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadImage } from "@/lib/storage/storage";
import { generateProductImage } from "./generate-image";

/**
 * Багцын poster-ийн нэг ажлыг гүйцэтгэнэ — `process-generation.ts`-ийн ихэр.
 * `after()` дотор service-role client-ээр ажиллана. Idempotent: аль хэдийн
 * `generating`/`done` болсон ажлыг алгасна.
 *
 * Үр дүн зөвхөн ажлын мөрөнд (`result_url`) бичигдэнэ; `collections.image_url`
 * руу админ «Ашиглах» дарж формоо хадгалсан үед л орно.
 */

interface JobRow {
  id: string;
  collection_id: string;
  status: string;
  prompt: string;
  reference_urls: string[];
  attempts: number;
}

export async function processCollectionGeneration(
  jobId: string,
): Promise<void> {
  const supabase = createAdminClient();
  if (!supabase) return;

  const { data } = await supabase
    .from("collection_image_generations")
    .select("id, collection_id, status, prompt, reference_urls, attempts")
    .eq("id", jobId)
    .maybeSingle();
  const job = data as JobRow | null;
  if (!job) return;
  if (job.status === "generating" || job.status === "done") return;

  await supabase
    .from("collection_image_generations")
    .update({ status: "generating", attempts: job.attempts + 1, error: null })
    .eq("id", jobId);

  try {
    // Card нь 1:1 тул дөрвөлжин; дөрвөн сав, шошготой тул өндөр чанар.
    const generated = await generateProductImage({
      prompt: job.prompt,
      referenceUrls: job.reference_urls,
      size: "1024x1024",
      quality: "high",
    });

    const { data: col } = await supabase
      .from("collections")
      .select("slug")
      .eq("id", job.collection_id)
      .maybeSingle();
    const slug = (col as { slug?: string } | null)?.slug ?? job.collection_id;

    const uploaded = await uploadImage(
      `collections/${slug}/ai-${randomUUID()}.${generated.ext}`,
      generated.buffer,
      generated.contentType,
    );
    if (!uploaded) throw new Error("Storage upload failed.");

    await supabase
      .from("collection_image_generations")
      .update({ status: "done", result_url: uploaded.url, error: null })
      .eq("id", jobId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase
      .from("collection_image_generations")
      .update({ status: "failed", error: msg.slice(0, 500) })
      .eq("id", jobId);
  }
}

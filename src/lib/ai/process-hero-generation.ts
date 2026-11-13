import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadImage } from "@/lib/storage/storage";
import { generateHeroImage } from "./generate-image";

/**
 * Hero-гийн нэг AI ажлыг гүйцэтгэнэ (`process-collection-generation.ts`-ийн
 * ихэр). `after()` дотор service-role-оор. Idempotent: аль хэдийн
 * `generating`/`done` ажлыг алгасна.
 *
 * Үр дүн = lossless PNG мастер (`hero/<group>/gen-<id>.png`). Hero-д
 * автоматаар ОРОХГҮЙ — админ «Ашиглах» дарахад webp хэмжээнүүд болно.
 */
interface JobRow {
  id: string;
  group_id: string;
  status: string;
  prompt: string;
  reference_urls: string[];
  size: string;
  attempts: number;
}

export async function processHeroGeneration(jobId: string): Promise<void> {
  const supabase = createAdminClient();
  if (!supabase) return;

  const { data } = await supabase
    .from("hero_image_generations")
    .select("id, group_id, status, prompt, reference_urls, size, attempts")
    .eq("id", jobId)
    .maybeSingle();
  const job = data as JobRow | null;
  if (!job || job.status === "generating" || job.status === "done") return;

  await supabase
    .from("hero_image_generations")
    .update({ status: "generating", attempts: job.attempts + 1, error: null })
    .eq("id", jobId);

  try {
    const png = await generateHeroImage({
      prompt: job.prompt,
      referenceUrls: job.reference_urls,
      size: job.size,
    });
    const up = await uploadImage(
      `hero/${job.group_id}/gen-${job.id}.png`,
      png,
      "image/png",
    );
    if (!up) throw new Error("Storage upload failed.");
    await supabase
      .from("hero_image_generations")
      .update({ status: "done", result_url: up.url, error: null })
      .eq("id", jobId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase
      .from("hero_image_generations")
      .update({ status: "failed", error: msg.slice(0, 500) })
      .eq("id", jobId);
  }
}

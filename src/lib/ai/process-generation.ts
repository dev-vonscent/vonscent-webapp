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
import { finishNoteImage } from "./note-image";

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

export interface ProcessOptions {
  /**
   * «Үнэрийн нот» зураг мөн эсэх. Тийм бол үр дүнг `finishNoteImage`-ээр
   * дамжуулж дэвсгэрийг нь жинхэнэ хар болгоно (саарал дэвсгэртэйг нь
   * буцаана) — энгийн packshot-д тэр боловсруулалт хэрэггүй.
   */
  note?: boolean;
  /**
   * `settings.imageGen`-ийг дарж бичих хэмжээ/чанар.
   *
   * Тэр тохиргоо нь `1024x1536` (босоо) байдаг ба каталогийн стандарт
   * packshot, нотын зураг хоёрын prompt нь ДӨРВӨЛЖИН хүрээнд бичигдсэн —
   * шинэ барааны шатууд (`new-product-pipeline.ts`) `1024x1024`-ийг шууд
   * бичдэг нь тиймээс. Тэдгээрийг гараас дуудахад ч мөн адил байх ёстой.
   */
  size?: ImageSize;
  quality?: ImageQuality;
}

export async function processGeneration(
  jobId: string,
  { note = false, size, quality }: ProcessOptions = {},
): Promise<void> {
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

    const generated = await generateProductImage({
      prompt: j.prompt,
      referenceUrl: j.reference_url,
      size: size ?? cfg.size,
      quality: quality ?? cfg.quality,
    });

    const { data: prod } = await supabase
      .from("products")
      .select("slug")
      .eq("id", j.product_id)
      .maybeSingle();
    const slug = (prod as { slug?: string } | null)?.slug ?? j.product_id;

    const file = note
      ? {
          data: (await finishNoteImage(generated.raw)).webp,
          contentType: "image/webp",
          path: `products/${slug}/notes-${randomUUID()}.webp`,
        }
      : {
          data: generated.buffer,
          contentType: generated.contentType,
          path: `products/${slug}/ai-${randomUUID()}.${generated.ext}`,
        };

    const uploaded = await uploadImage(file.path, file.data, file.contentType);
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

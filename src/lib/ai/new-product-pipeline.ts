import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadImage } from "@/lib/storage/storage";
import { addGalleryImage } from "@/features/admin/image-gen";
import { generateProductImage } from "./generate-image";
import { PACKSHOT_PROMPT } from "./packshot-prompt";
import { buildNoteImagePrompt, finishNoteImage, MAX_NOTES } from "./note-image";
import { pickNotes } from "./notes-en";

/**
 * The two pictures a new product gets from one uploaded reference bottle.
 *
 *   reference photo the admin uploaded
 *        │
 *        ├─ 1. PACKSHOT_PROMPT ──────────► main image   (sort_order 0)
 *        │                                      │
 *        └─ 2. note prompt, using ◄─────────────┘
 *              the packshot as its reference ──► note image (sort_order 1)
 *
 * The second stage deliberately works from the **generated** packshot rather
 * than from the admin's upload: by then the bottle has already been put on the
 * shop's standard sweep at the shop's standard scale, so the note image inherits
 * that framing instead of re-deriving it from a phone photo. It is the same
 * chain `scripts/gen-note-images.ts` runs across the existing catalogue, where
 * the reference is each product's current main image.
 *
 * Both stages are recorded as `product_image_generations` rows so the admin
 * table's status polling shows progress and a failure keeps its reason.
 */

/** Both prompts are written for a square frame. */
const SIZE = "1024x1024" as const;
const QUALITY = "high" as const;

interface ProductRow {
  slug: string;
  notes_top: string[];
  notes_heart: string[];
  notes_base: string[];
}

async function startJob(
  supabase: SupabaseClient,
  productId: string,
  prompt: string,
  referenceUrl: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("product_image_generations")
    .insert({
      product_id: productId,
      status: "generating",
      attempts: 1,
      prompt,
      reference_url: referenceUrl,
    })
    .select("id")
    .single();
  return (data as { id: string } | null)?.id ?? null;
}

/**
 * Ажлыг ДАРААЛАЛД тавина (`pending`): лавлах зураг нь хараахан байхгүй, эхний
 * шат дуусахад бөглөгдөнө. Мөр урьдчилж үүсэх нь UI-д хэрэгтэй — админ хоёр
 * зураг бэлдэгдэж байгааг нэг дороос харна.
 */
async function queueJob(
  supabase: SupabaseClient,
  productId: string,
  prompt: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("product_image_generations")
    .insert({ product_id: productId, status: "pending", prompt })
    .select("id")
    .single();
  return (data as { id: string } | null)?.id ?? null;
}

async function finishJob(
  supabase: SupabaseClient,
  jobId: string | null,
  patch: Record<string, unknown>,
): Promise<void> {
  if (!jobId) return;
  await supabase
    .from("product_image_generations")
    .update(patch)
    .eq("id", jobId);
}

/**
 * Run both stages for a freshly created product.
 *
 * Called from `after()` so the admin gets their redirect immediately. Never
 * throws: a failure is written to the job row, which is what the table polls.
 */
export async function runNewProductImages(
  productId: string,
  referenceUrl: string,
): Promise<void> {
  const supabase = createAdminClient();
  if (!supabase) return;

  const { data } = await supabase
    .from("products")
    .select("slug, notes_top, notes_heart, notes_base")
    .eq("id", productId)
    .maybeSingle();
  const product = data as ProductRow | null;
  if (!product) return;

  // Нот нь эхлээд хэрэгтэй: хоёр дахь ажлын мөрийг УРЬДЧИЛЖ үүсгэвэл админ
  // барааныхаа хуудсыг нээхэд «нэг нь үүсэж байна, нөгөө нь дараалалд» гэж
  // харагдана. Хийсвэр аккорд (мускус, амбер) л байвал зурах юм алга.
  const notes = pickNotes(
    {
      top: product.notes_top ?? [],
      heart: product.notes_heart ?? [],
      base: product.notes_base ?? [],
    },
    MAX_NOTES,
  );
  const notePrompt = notes.length ? buildNoteImagePrompt(notes) : null;

  // ── 1. Packshot → the main image ────────────────────────────────────────
  const packshotJob = await startJob(
    supabase,
    productId,
    PACKSHOT_PROMPT,
    referenceUrl,
  );
  // Лавлах нь packshot өөрөө болно — түүнийг гартал хоосон, төлөв нь
  // `pending` (дараалалд).
  const noteJob = notePrompt ? await queueJob(supabase, productId, notePrompt) : null;
  let packshotUrl: string;
  try {
    const { buffer, contentType, ext } = await generateProductImage({
      prompt: PACKSHOT_PROMPT,
      referenceUrl,
      size: SIZE,
      quality: QUALITY,
    });
    const uploaded = await uploadImage(
      `products/${product.slug}/ai-${randomUUID()}.${ext}`,
      buffer,
      contentType,
    );
    if (!uploaded) throw new Error("Storage upload failed.");
    packshotUrl = uploaded.url;

    // Visible, unlike a regeneration: this *is* the product's picture, and a
    // product created this way has nothing else to show until it lands.
    await addGalleryImage(supabase, productId, packshotUrl, true);
    await finishJob(supabase, packshotJob, {
      status: "done",
      result_url: packshotUrl,
      error: null,
    });
  } catch (e) {
    await finishJob(supabase, packshotJob, {
      status: "failed",
      error: (e instanceof Error ? e.message : String(e)).slice(0, 500),
    });
    // Дараалалд байсан нотын ажил мөнхийн «pending» болж үлдэх ёсгүй.
    await finishJob(supabase, noteJob, {
      status: "failed",
      error: "Үндсэн зураг үүсээгүй тул үнэрийн зураг зогслоо.",
    });
    return; // stage 2 has nothing to work from
  }

  // ── 2. Note image → the second gallery picture ──────────────────────────
  if (!noteJob || !notePrompt) return;
  await finishJob(supabase, noteJob, {
    status: "generating",
    attempts: 1,
    reference_url: packshotUrl,
  });
  try {
    const { raw } = await generateProductImage({
      prompt: notePrompt,
      referenceUrl: packshotUrl,
      size: SIZE,
      quality: QUALITY,
    });
    // Clamps the backdrop to a true #000000 and refuses a grey one.
    const { webp } = await finishNoteImage(raw);

    const uploaded = await uploadImage(
      `products/${product.slug}/notes-${randomUUID()}.webp`,
      webp,
      "image/webp",
    );
    if (!uploaded) throw new Error("Storage upload failed.");

    await addGalleryImage(supabase, productId, uploaded.url, true);
    await finishJob(supabase, noteJob, {
      status: "done",
      result_url: uploaded.url,
      error: null,
    });
  } catch (e) {
    await finishJob(supabase, noteJob, {
      status: "failed",
      error: (e instanceof Error ? e.message : String(e)).slice(0, 500),
    });
  }
}

import { NextResponse, after } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured, isImageGenConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffUser } from "@/lib/auth/guard";
import { processGeneration } from "@/lib/ai/process-generation";
import { PACKSHOT_PROMPT } from "@/lib/ai/packshot-prompt";
import { buildNoteImagePrompt, MAX_NOTES } from "@/lib/ai/note-image";
import { pickNotes } from "@/lib/ai/notes-en";

const schema = z.object({ kind: z.enum(["packshot", "notes"]) });

/** Зураг үүсэх нь хариу буцсаны дараа (`after()`) үргэлжилнэ. */
export const maxDuration = 300;

interface ProductRow {
  slug: string;
  notes_top: string[] | null;
  notes_heart: string[] | null;
  notes_base: string[] | null;
  reference_image_url: string | null;
}

/**
 * Хоёр стандарт зургийн аль нэгийг дахин үүсгэх (админы «Зураг нэмэх» хэсэг).
 *
 * Энэ бол шинэ бараа үүсгэх үед автоматаар ажилладаг хоёр шатыг
 * (`new-product-pipeline.ts`) гараар дуудаж байгаа хэрэг — prompt нь ЯГ тэр
 * хоёр үндсэн prompt:
 *   • `packshot` — лонхыг дэлгүүрийн жишиг цайвар саарал дэвсгэр дээр;
 *   • `notes`    — лонхны ард үнэрийн орцууд хөвсөн хар дэвсгэртэй зураг.
 *
 * Лавлахыг сервер сонгоно: packshot нь барааны хадгалсан лавлах лонхноос,
 * нотын зураг нь галерейн одоогийн үндсэн зургаас (pipeline-д ч packshot нь
 * нотын зургийн лавлах болдог — тэгснээр хүрээ, хэмжээ нь өвлөгдөнө).
 *
 * Үр дүн нь галерейд ШИНЭ мөр болж, сонгогдоогүй байдлаар нэмэгдэнэ.
 */
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

  const { data } = await supabase
    .from("products")
    .select("slug, notes_top, notes_heart, notes_base, reference_image_url")
    .eq("id", id)
    .maybeSingle();
  const product = data as ProductRow | null;
  if (!product) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  // Галерейн үндсэн зураг: сайтад харагдаж байгаагийн эхнийх, эс бөгөөс хамгийн
  // эхний мөр.
  const { data: rows } = await supabase
    .from("product_images")
    .select("url, is_visible, sort_order")
    .eq("product_id", id)
    .order("sort_order", { ascending: true });
  const images = (rows ?? []) as { url: string; is_visible: boolean }[];
  const mainImage = (images.find((r) => r.is_visible) ?? images[0])?.url ?? null;

  const notes = pickNotes(
    {
      top: product.notes_top ?? [],
      heart: product.notes_heart ?? [],
      base: product.notes_base ?? [],
    },
    MAX_NOTES,
  );

  const isNote = parsed.data.kind === "notes";
  const referenceUrl = isNote
    ? (mainImage ?? product.reference_image_url)
    : (product.reference_image_url ?? mainImage);
  if (!referenceUrl) {
    return NextResponse.json({ error: "NO_REFERENCE" }, { status: 400 });
  }
  // Бүх нот нь хийсвэр аккорд (мускус, амбер) бол зурах юм алга.
  if (isNote && notes.length === 0) {
    return NextResponse.json({ error: "NO_NOTES" }, { status: 400 });
  }

  const prompt = isNote ? buildNoteImagePrompt(notes) : PACKSHOT_PROMPT;
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
    // Шинэ бараа үүсэх үеийн шатуудтай ижил: дөрвөлжин хүрээ, өндөр чанар.
    // `settings.imageGen`-ийн `1024x1536` нь эдгээр prompt-д тохирохгүй.
    await processGeneration(jobId, {
      note: isNote,
      size: "1024x1024",
      quality: "high",
    });
  });
  return NextResponse.json({ jobId });
}

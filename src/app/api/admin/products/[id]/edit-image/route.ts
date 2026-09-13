import { NextResponse, after } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured, isImageGenConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffUser } from "@/lib/auth/guard";
import { processGeneration } from "@/lib/ai/process-generation";

/** Каталогийн жишиг хүрээ — заавар бүрийн ард залгагдана. */
const SQUARE_FRAME = "Square 1:1 aspect ratio, the full subject inside the frame.";

const schema = z.object({
  /** Галерейн зураг — түүнийг лавлах болгож засна. */
  referenceUrl: z.string().url(),
  /** Админы бичсэн заавар. ЯГ энэ текст загварт очно. */
  prompt: z.string().trim().min(1).max(2000),
});

/** Зураг үүсэх нь хариу буцсаны дараа (`after()`) үргэлжилнэ. */
export const maxDuration = 300;

/**
 * Галерейн нэг зургийг зааврын дагуу засварлах (image-to-image).
 *
 * `regenerate-image`-аас ялгаатай нь ЭНД prompt-ыг сервер бүтээхгүй: барааны
 * нэр, төрөл, DEFAULT_BASE_PROMPT ямар ч хэлбэрээр нэмэгдэхгүй, админы бичсэн
 * өгүүлбэр яг тэр чигээрээ загварт очно. Цорын ганц нэмэлт нь хүрээний
 * харьцаа (`SQUARE_FRAME`): каталогийн бүх зураг 1:1 бөгөөд `size` параметр
 * дангаараа хангалтгүй — заавар нь өөрөө өөр харьцаа санал болговол загвар
 * зургаа тэр хэлбэрт нь тайрдаг. Тухайн зураг өөрөө лавлах болно —
 * «фоныг цагаан болго» гэх мэт жижиг засварт үндсэн prompt нь хөндлөнгөөс
 * оролцоод өөр зураг гаргачихдаг.
 *
 * Ажлын мөр нь `product_image_generations` — бусад үүсэлттэй ижил тул төлөв
 * хөтлөлт, дуусахад галерейд бичигдэх (`addGalleryImage`, сонгогдоогүйгээр)
 * бүгд бэлэн ирнэ. Эх зураг байрандаа хэвээр үлдэнэ: үр дүн нь ШИНЭ мөр.
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

  // Лавлах нь ЭНЭ барааны галерейн зураг мөн эсэх. Сервер өгөгдсөн хаягаар
  // зураг татдаг тул дурын URL хүлээж авах нь хэрэггүй эрсдэл.
  const { data: owned } = await supabase
    .from("product_images")
    .select("id")
    .eq("product_id", id)
    .eq("url", parsed.data.referenceUrl)
    .maybeSingle();
  if (!owned) {
    return NextResponse.json({ error: "UNKNOWN_IMAGE" }, { status: 400 });
  }

  const { data: job, error } = await supabase
    .from("product_image_generations")
    .insert({
      product_id: id,
      status: "pending",
      prompt: `${parsed.data.prompt}\n\n${SQUARE_FRAME}`,
      reference_url: parsed.data.referenceUrl,
    })
    .select("id")
    .single();
  if (error || !job) {
    return NextResponse.json({ error: "ENQUEUE_FAILED" }, { status: 500 });
  }

  const jobId = (job as { id: string }).id;
  after(async () => {
    // Галерейн зураг дөрвөлжин (каталогийн жишиг) тул засвар нь ч дөрвөлжин
    // байх ёстой — `settings.imageGen`-ийн босоо хэмжээ энд тохирохгүй.
    await processGeneration(jobId, { size: "1024x1024", quality: "high" });
  });
  return NextResponse.json({ jobId });
}

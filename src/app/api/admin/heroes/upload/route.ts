import { NextResponse } from "next/server";
import { z } from "zod";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/storage/limits";
import { imageUploadFailure } from "@/lib/storage/report";
import { heroAdminGate, processHeroImage } from "@/features/heroes/server";

export const dynamic = "force-dynamic";
// 3 хэмжээ × webp encode — 3200px дээр хэдэн секунд.
export const maxDuration = 60;

const fieldsSchema = z.object({
  kind: z.enum(["desktop", "mobile"]),
  // Нэг hero-гийн зургийг нэг хавтаст — шинэ hero-д client uuid үүсгэнэ.
  groupId: z.string().uuid(),
});

/**
 * Hero-гийн зураг (plan §8.1 «Өөрийн зураг оруулах», §12): MIME + хэмжээ +
 * харьцаа шалгаж, sharp-аар дахин encode хийнэ. Хөтөч өмнө нь 3200px-ийн
 * JPEG болгож илгээдэг (Vercel 4.5MB хязгаар) — энд юуг ч итгэхгүй.
 */
export async function POST(req: Request) {
  try {
    const gate = await heroAdminGate();
    if ("response" in gate) return gate.response;

    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    const fields = fieldsSchema.safeParse({
      kind: form?.get("kind"),
      groupId: form?.get("groupId"),
    });
    if (!(file instanceof File) || !fields.success) {
      return NextResponse.json({ error: "Буруу хүсэлт." }, { status: 400 });
    }
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "PNG, JPEG эсвэл WebP зураг оруулна уу." },
        { status: 400 },
      );
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: "Зураг хэт том (4MB хүртэл)." },
        { status: 400 },
      );
    }
    const result = await processHeroImage(
      await file.arrayBuffer(),
      fields.data.kind,
      fields.data.groupId,
    );
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (err) {
    return imageUploadFailure(err);
  }
}

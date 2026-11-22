import { NextResponse } from "next/server";
import { revalidatePublic } from "@/lib/cache";
import { storagePath } from "@/lib/storage/storage";
import { giftCardDesignSchema } from "@/lib/validators/gift-card";
import { giftCardsAdminGate } from "@/features/gift-cards/admin-api";

/**
 * Админ: загвар засах (нэр, гарчиг, мэндчилгээ, дэвсгэр зураг, өнгө, идэвх,
 * эрэмбэ). Шинэ загвар нэмэх нь migration/seed — id нь кодонд холбогддог.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await giftCardsAdminGate();
  if ("error" in gate) return gate.error;
  const { id } = await params;
  if (!/^[a-z0-9-]{2,40}$/u.test(id)) {
    return NextResponse.json({ error: "Буруу хүсэлт." }, { status: 400 });
  }
  const parsed = giftCardDesignSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Буруу хүсэлт." },
      { status: 400 },
    );
  }
  const v = parsed.data;
  const imagePath = v.imageUrl ? storagePath(v.imageUrl) : null;
  if (v.imageUrl && !imagePath) {
    return NextResponse.json(
      { error: "Зургийг энэ хуудаснаас байршуулна уу." },
      { status: 400 },
    );
  }
  const { data, error } = await gate.supabase
    .from("gift_card_designs")
    .update({
      title: v.title,
      heading: v.heading,
      default_message: v.defaultMessage || null,
      image_path: imagePath,
      bg_color: v.bgColor,
      text_color: v.textColor,
      muted_color: v.mutedColor,
      accent_color: v.accentColor,
      sort_order: v.sortOrder,
      is_active: v.isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id");
  if (error) {
    return NextResponse.json({ error: "Хадгалахад алдаа гарлаа." }, { status: 500 });
  }
  if (!(data as unknown[] | null)?.length) {
    return NextResponse.json({ error: "Загвар олдсонгүй." }, { status: 404 });
  }
  revalidatePublic();
  return NextResponse.json({ ok: true });
}

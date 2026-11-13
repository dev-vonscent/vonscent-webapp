import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteImage, storagePath } from "@/lib/storage/storage";
import { heroAdminGate } from "@/features/heroes/server";

export const dynamic = "force-dynamic";

const idSchema = z.string().uuid();

/**
 * Хувилбарыг түүхээс устгах — амжилтгүй эсвэл хэрэггүй (`failed`, `done`).
 * Явж буй ажлыг устгахгүй (`after()` дуусахдаа мөрөө шинэчилнэ). PNG мастер
 * storage-оос мөн устна; «Ашиглах» дарж hero-д орсон зураг нь тусдаа webp
 * хувилбар тул хөндөгдөхгүй.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await heroAdminGate();
  if ("response" in gate) return gate.response;
  const id = idSchema.safeParse((await params).id);
  if (!id.success) {
    return NextResponse.json({ error: "Буруу хүсэлт." }, { status: 400 });
  }
  const { data, error } = await gate.supabase
    .from("hero_image_generations")
    .delete()
    .eq("id", id.data)
    .in("status", ["failed", "done"])
    .select("result_url");
  if (error) {
    return NextResponse.json({ error: "Устгаж чадсангүй." }, { status: 500 });
  }
  if (!data?.length) {
    return NextResponse.json(
      { error: "Үүсгэж байгаа зургийг устгах боломжгүй — дуусахыг хүлээнэ үү." },
      { status: 409 },
    );
  }
  const path = storagePath(
    (data[0] as { result_url: string | null }).result_url ?? "",
  );
  if (path?.startsWith("hero/")) await deleteImage(path);
  return NextResponse.json({ ok: true });
}

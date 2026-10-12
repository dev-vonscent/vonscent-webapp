import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePublic } from "@/lib/cache";
import { isSupabaseConfigured } from "@/lib/env";
import { getStaffUser } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { callRpc } from "@/lib/supabase/rpc";
import { NO_IMAGE, hasVisibleImage } from "@/features/admin/lib/product-status";

type LaunchResult =
  | "launched"
  | "already_active"
  | "not_coming_soon"
  | "not_found";

/**
 * «Тун удахгүй» барааг худалдаанд гаргах (0125 `launch_product`).
 *
 * Засах хуудасны «Худалдаанд гаргах» товч, нөөц нэмсний дараах асуулт,
 * жагсаалтын мөрийн үйлдэл гурвуулаа энэ ганц замаар явна. Нөхцөлтэй UPDATE
 * тул хуучирсан дэлгэцээс дарсан ч зөвхөн ОДОО «Тун удахгүй» байгаа барааг
 * гаргана; давхар дарвал амжилт гэж үзнэ.
 */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const parsed = z
    .string()
    .uuid()
    .safeParse((await ctx.params).id);
  // UUID биш id нь Postgres-ийн cast алдаа болж 500 буцаадаг байсан.
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }
  const id = parsed.data;
  if (!isSupabaseConfigured) return NextResponse.json({ demo: true });

  const staff = await getStaffUser();
  if (!staff) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: "NO_DB" }, { status: 500 });

  // Зураггүй барааг дэлгүүрт гаргахгүй (PATCH-ийн дүрэмтэй ижил).
  const hasImage = await hasVisibleImage(supabase, id);
  if (hasImage === null) {
    return NextResponse.json(
      { error: "Худалдаанд гаргаж чадсангүй. Дахин оролдоно уу." },
      { status: 500 },
    );
  }
  if (!hasImage) return NextResponse.json(NO_IMAGE, { status: 409 });

  const { data, error } = await callRpc<LaunchResult>(
    supabase,
    "launch_product",
    { p_id: id },
  );
  if (error || !data) {
    return NextResponse.json(
      { error: "Худалдаанд гаргаж чадсангүй. Дахин оролдоно уу." },
      { status: 500 },
    );
  }
  if (data === "not_found") {
    return NextResponse.json({ error: "Бараа олдсонгүй." }, { status: 404 });
  }
  if (data === "not_coming_soon") {
    return NextResponse.json(
      {
        error:
          "Энэ бараа «Тун удахгүй» төлөвт байхаа больжээ. Хуудсаа сэргээгээд шалгана уу.",
      },
      { status: 409 },
    );
  }

  // Commit-ийн ДАРАА: бараа одоо каталог, «Шинэ» хэсэгт орох ёстой.
  if (data === "launched") revalidatePublic();
  return NextResponse.json({ ok: true, result: data });
}

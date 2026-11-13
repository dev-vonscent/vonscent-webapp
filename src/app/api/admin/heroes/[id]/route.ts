import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePublic } from "@/lib/cache";
import { heroInputSchema } from "@/lib/validators/hero";
import {
  checkHeroRefs,
  heroAdminGate,
  heroWriteError,
  toHeroColumns,
} from "@/features/heroes/server";

export const dynamic = "force-dynamic";

const idSchema = z.string().uuid();
type Ctx = { params: Promise<{ id: string }> };

/** Бүтэн засвар. Идэвхтэй hero-г засвал нүүрэнд шууд нөлөөлнө. */
export async function PUT(req: Request, { params }: Ctx) {
  const gate = await heroAdminGate();
  if ("response" in gate) return gate.response;

  const id = idSchema.safeParse((await params).id);
  const parsed = heroInputSchema.safeParse(await req.json().catch(() => null));
  if (!id.success) {
    return NextResponse.json({ error: "Буруу хүсэлт." }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Буруу хүсэлт." },
      { status: 400 },
    );
  }
  const refError = await checkHeroRefs(gate.supabase, parsed.data);
  if (refError) return NextResponse.json({ error: refError }, { status: 400 });

  const { data, error } = await gate.supabase
    .from("heroes")
    .update(toHeroColumns(parsed.data))
    .eq("id", id.data)
    .select("id");
  if (error) return heroWriteError(error.message);
  if (!data?.length) {
    return NextResponse.json({ error: "Hero олдсонгүй." }, { status: 404 });
  }
  revalidatePublic();
  return NextResponse.json({ id: id.data });
}

const toggleSchema = z.object({ isActive: z.boolean() });

/** Нийтлэх / нуух. Зураггүй hero-г DB check нийтлүүлэхгүй. */
export async function PATCH(req: Request, { params }: Ctx) {
  const gate = await heroAdminGate();
  if ("response" in gate) return gate.response;

  const id = idSchema.safeParse((await params).id);
  const parsed = toggleSchema.safeParse(await req.json().catch(() => null));
  if (!id.success || !parsed.success) {
    return NextResponse.json({ error: "Буруу хүсэлт." }, { status: 400 });
  }
  const { data, error } = await gate.supabase
    .from("heroes")
    .update({ is_active: parsed.data.isActive })
    .eq("id", id.data)
    .select("id");
  if (error) return heroWriteError(error.message);
  if (!data?.length) {
    return NextResponse.json({ error: "Hero олдсонгүй." }, { status: 404 });
  }
  revalidatePublic();
  return NextResponse.json({ ok: true });
}

/** Устгах. Storage-ийн зураг үлдэнэ (давтагдашгүй зам, жижиг). */
export async function DELETE(_req: Request, { params }: Ctx) {
  const gate = await heroAdminGate();
  if ("response" in gate) return gate.response;

  const id = idSchema.safeParse((await params).id);
  if (!id.success) {
    return NextResponse.json({ error: "Буруу хүсэлт." }, { status: 400 });
  }
  const { error } = await gate.supabase.from("heroes").delete().eq("id", id.data);
  if (error) return heroWriteError(error.message);
  revalidatePublic();
  return NextResponse.json({ ok: true });
}

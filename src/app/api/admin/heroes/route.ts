import { NextResponse } from "next/server";
import { revalidatePublic } from "@/lib/cache";
import { heroInputSchema } from "@/lib/validators/hero";
import {
  checkHeroRefs,
  heroAdminGate,
  heroWriteError,
  toHeroColumns,
} from "@/features/heroes/server";

export const dynamic = "force-dynamic";

/** Шинэ hero (0182). Туг (404) → staff (403) → Zod → холбоос шалгах. */
export async function POST(req: Request) {
  const gate = await heroAdminGate();
  if ("response" in gate) return gate.response;

  const parsed = heroInputSchema.safeParse(await req.json().catch(() => null));
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
    .insert({ ...toHeroColumns(parsed.data), created_by: gate.staff.id })
    .select("id")
    .single();
  if (error) return heroWriteError(error.message);
  revalidatePublic();
  return NextResponse.json({ id: (data as { id: string }).id });
}

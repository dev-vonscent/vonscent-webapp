import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePublic } from "@/lib/cache";
import { namedSaleGate, namedSaleWriteError } from "@/features/sales/server";

export const dynamic = "force-dynamic";

/** Явж буй хямдралыг яг одоо дуусгах (16.4, `end_sale`). */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await namedSaleGate();
  if ("response" in gate) return gate.response;
  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) {
    return NextResponse.json({ error: "Хямдрал олдсонгүй." }, { status: 404 });
  }
  const { error } = await gate.supabase.rpc("end_sale", { p_id: id.data });
  if (error) return namedSaleWriteError(error);
  revalidatePublic();
  return NextResponse.json({ ok: true });
}

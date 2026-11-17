import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePublic } from "@/lib/cache";
import { namedSaleSchema } from "@/lib/validators/sale";
import {
  namedSaleGate,
  namedSaleWriteError,
  toSaveSaleRpc,
} from "@/features/sales/server";

export const dynamic = "force-dynamic";

const idSchema = z.string().uuid();

type Ctx = { params: Promise<{ id: string }> };

/** Нэртэй хямдрал засах (16.4): нэр, хугацаа, бараа, хувь. */
export async function PUT(req: Request, { params }: Ctx) {
  const gate = await namedSaleGate();
  if ("response" in gate) return gate.response;
  const id = idSchema.safeParse((await params).id);
  if (!id.success) {
    return NextResponse.json({ error: "Хямдрал олдсонгүй." }, { status: 404 });
  }

  const parsed = namedSaleSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Буруу хүсэлт." },
      { status: 400 },
    );
  }

  const { error } = await gate.supabase.rpc(
    "save_sale",
    // Нэрт хямдралыг засахад «Нэргүй»-г хэзээ ч шилжүүлэхгүй.
    toSaveSaleRpc(id.data, { ...parsed.data, adoptUnnamed: false }, gate.staff.id),
  );
  if (error) return namedSaleWriteError(error);
  revalidatePublic();
  return NextResponse.json({ id: id.data });
}

/** Устгах — хямдралын үнэ шууд арилна (эхлээгүй хямдралыг цуцлах). */
export async function DELETE(_req: Request, { params }: Ctx) {
  const gate = await namedSaleGate();
  if ("response" in gate) return gate.response;
  const id = idSchema.safeParse((await params).id);
  if (!id.success) {
    return NextResponse.json({ error: "Хямдрал олдсонгүй." }, { status: 404 });
  }
  const { error } = await gate.supabase.rpc("delete_sale", { p_id: id.data });
  if (error) return namedSaleWriteError(error);
  revalidatePublic();
  return NextResponse.json({ ok: true });
}

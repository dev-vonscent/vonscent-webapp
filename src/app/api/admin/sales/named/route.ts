import { NextResponse } from "next/server";
import { revalidatePublic } from "@/lib/cache";
import { namedSaleSchema } from "@/lib/validators/sale";
import {
  namedSaleGate,
  namedSaleWriteError,
  toSaveSaleRpc,
} from "@/features/sales/server";

export const dynamic = "force-dynamic";

/**
 * Шинэ нэртэй хямдрал (0188 `save_sale`), эсвэл «Нэргүй»-г нэрлэх
 * (`adoptUnnamed`). Туг → staff → Zod → RPC (туг, 16.3, 16.5-ыг дахин шалгана).
 */
export async function POST(req: Request) {
  const gate = await namedSaleGate();
  if ("response" in gate) return gate.response;

  const parsed = namedSaleSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Буруу хүсэлт." },
      { status: 400 },
    );
  }

  const { data, error } = await gate.supabase.rpc(
    "save_sale",
    toSaveSaleRpc(null, parsed.data, gate.staff.id),
  );
  if (error) return namedSaleWriteError(error);
  revalidatePublic();
  return NextResponse.json({ id: data as string });
}

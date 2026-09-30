import { NextResponse } from "next/server";
import { z } from "zod";
import { quoteBundleSizes } from "@/features/checkout/api";

// uuid биш `min(1)`: Supabase-гүй (seed) горимд барааны id нь slug.
const id = z.string().min(1).max(200);
const bodySchema = z.object({
  collectionId: id.nullable(),
  type: z.enum(["base", "custom"]),
  productIds: z.array(id).min(1).max(50),
});

/**
 * Сагсан дахь багцын хэмжээ бүрийн үнэ + гишүүдийн үлдэгдэл — төлбөрийн
 * хуудасны «Засах» dialog-оос багцын ml солиход. Нийтийн өгөгдөл (үнэ,
 * боломжтой эсэх); үнэлгээ нь захиалгын `priceCollectionLines`-тай нэг зам.
 */
export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }
  if (new Set(parsed.data.productIds).size !== parsed.data.productIds.length) {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }
  return NextResponse.json(await quoteBundleSizes(parsed.data));
}

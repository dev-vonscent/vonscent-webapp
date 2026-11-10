import { NextResponse } from "next/server";
import { z } from "zod";
import { extrasAdminGate } from "@/features/extras/admin-route";

/**
 * Үлдэгдэлтэй шилний эх үнэртэн — маягт сонгосон даруйд брэнд, нэр, хүйс,
 * зураг, декантад үлдсэн ml-ийг автоматаар бөглөнө (plan §7.2).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await extrasAdminGate();
  if ("error" in gate) return gate.error;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Буруу хүсэлт." }, { status: 400 });
  }
  const { data } = await gate.supabase
    .from("products")
    .select(
      "id, name, brand, gender, bottle_ml, inventory(available_ml), product_images(url, sort_order, is_visible)",
    )
    .eq("id", id)
    .maybeSingle();
  const p = data as {
    id: string;
    name: string;
    brand: string;
    gender: string;
    bottle_ml: number;
    inventory: { available_ml: number | null } | null;
    product_images:
      | { url: string; sort_order: number; is_visible: boolean }[]
      | null;
  } | null;
  if (!p) {
    return NextResponse.json({ error: "Үнэртэн олдсонгүй." }, { status: 404 });
  }
  const image =
    (p.product_images ?? [])
      .filter((i) => i.is_visible)
      .sort((a, b) => a.sort_order - b.sort_order)[0]?.url ?? null;
  return NextResponse.json({
    id: p.id,
    name: p.name,
    brand: p.brand,
    gender: p.gender,
    bottleMl: p.bottle_ml,
    image,
    availableMl: p.inventory?.available_ml ?? 0,
  });
}

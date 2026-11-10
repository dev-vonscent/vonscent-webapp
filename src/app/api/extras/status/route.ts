import { NextResponse } from "next/server";
import { z } from "zod";
import { createPublicClient } from "@/lib/supabase/public";
import { callRpc } from "@/lib/supabase/rpc";

const ids = z.array(z.string().uuid()).min(1).max(50);

/**
 * Сагсны нэмэлт барааны мөр одоо зарагдах уу (0150 `extras_variant_status`).
 * Хариунд ирээгүй id = худалдаанаас хасагдсан (эсвэл туг хаалттай).
 * `available` null = хязгааргүй.
 */
export async function GET(req: Request) {
  const raw = (new URL(req.url).searchParams.get("ids") ?? "")
    .split(",")
    .filter(Boolean);
  const parsed = ids.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }
  const supabase = createPublicClient();
  if (!supabase) return NextResponse.json({ items: [] });
  const { data, error } = await callRpc<
    { id: string; price: number; available: number | null }[]
  >(supabase, "extras_variant_status", { p_ids: parsed.data });
  if (error) {
    return NextResponse.json({ error: "STATUS_FAILED" }, { status: 500 });
  }
  return NextResponse.json(
    { items: data ?? [] },
    { headers: { "Cache-Control": "no-store" } },
  );
}

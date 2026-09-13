import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffUser } from "@/lib/auth/guard";

export interface ImageStatus {
  productId: string;
  /** Latest generation status, or "none" when the product has no AI job. */
  status: "none" | "pending" | "generating" | "done" | "failed";
  error: string | null;
  /** Яг одоо үүсч байгаа ажлын тоо (`generating`). */
  generating: number;
  /** Дараалалд хүлээж байгаа ажлын тоо (`pending`). */
  queued: number;
}

/**
 * Poll the AI-image status of several products (admin table + image studio).
 *
 * It reports the *job*, nothing else. A finished image is no longer something
 * to reconcile against the gallery: `processGeneration` files it as a gallery
 * row the moment it lands (0049), so the only question left here is whether the
 * job is still running and, if it failed, why.
 */
export async function GET(req: Request) {
  const ids = (new URL(req.url).searchParams.get("ids") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!isSupabaseConfigured || ids.length === 0) {
    return NextResponse.json({ statuses: [] });
  }
  const staff = await getStaffUser();
  if (!staff) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: "NO_DB" }, { status: 500 });

  const { data: gens } = await supabase
    .from("product_image_generations")
    .select("product_id, status, error, created_at")
    .in("product_id", ids)
    .order("created_at", { ascending: false });

  const latest = new Map<string, { status: string; error: string | null }>();
  // Хэдэн ажил амьд байгаа нь галерейн хүлээлтийн картуудын тоо болно:
  // шинэ бараа хоёр зурагтай (үндсэн + үнэрийн нот) тул нэг нь үүсэж байхад
  // нөгөө нь дараалалд хүлээж байдаг.
  const active = new Map<string, { generating: number; queued: number }>();
  for (const g of (gens as
    | { product_id: string; status: string; error: string | null }[]
    | null) ?? []) {
    if (!latest.has(g.product_id)) latest.set(g.product_id, g);
    if (g.status === "generating" || g.status === "pending") {
      const a = active.get(g.product_id) ?? { generating: 0, queued: 0 };
      if (g.status === "generating") a.generating += 1;
      else a.queued += 1;
      active.set(g.product_id, a);
    }
  }

  const statuses: ImageStatus[] = ids.map((productId) => {
    const g = latest.get(productId);
    const a = active.get(productId);
    return {
      productId,
      status: (g?.status as ImageStatus["status"]) ?? "none",
      error: g?.error ?? null,
      generating: a?.generating ?? 0,
      queued: a?.queued ?? 0,
    };
  });

  return NextResponse.json({ statuses });
}

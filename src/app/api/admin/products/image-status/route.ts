import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffUser } from "@/lib/auth/guard";

export interface ImageStatus {
  productId: string;
  /** Latest generation status, or "none" when the product has no AI job. */
  status: "none" | "pending" | "generating" | "done" | "failed";
  error: string | null;
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
  for (const g of (gens as
    | { product_id: string; status: string; error: string | null }[]
    | null) ?? []) {
    if (!latest.has(g.product_id)) latest.set(g.product_id, g);
  }

  const statuses: ImageStatus[] = ids.map((productId) => {
    const g = latest.get(productId);
    return {
      productId,
      status: (g?.status as ImageStatus["status"]) ?? "none",
      error: g?.error ?? null,
    };
  });

  return NextResponse.json({ statuses });
}

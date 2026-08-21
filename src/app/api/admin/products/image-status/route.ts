import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffUser } from "@/lib/auth/guard";

export interface ImageStatus {
  productId: string;
  /** Latest generation status, or "none" when the product has no AI job. */
  status: "none" | "pending" | "generating" | "done" | "failed";
  /** Currently published image (product_images sort_order 0), if any. */
  published: string | null;
  /** Latest generated image (may be unapproved), if any. */
  resultUrl: string | null;
  generationId: string | null;
  prompt: string;
  error: string | null;
}

/** Poll the AI-image status of several products (admin table, §6.4). */
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

  const [{ data: gens }, { data: imgs }] = await Promise.all([
    supabase
      .from("product_image_generations")
      .select("id, product_id, status, result_url, prompt, error, created_at")
      .in("product_id", ids)
      .order("created_at", { ascending: false }),
    supabase
      .from("product_images")
      .select("product_id, url")
      .in("product_id", ids)
      .eq("sort_order", 0),
  ]);

  const latest = new Map<
    string,
    {
      id: string;
      status: string;
      result_url: string | null;
      prompt: string;
      error: string | null;
    }
  >();
  for (const g of (gens as
    | {
        id: string;
        product_id: string;
        status: string;
        result_url: string | null;
        prompt: string;
        error: string | null;
      }[]
    | null) ?? []) {
    if (!latest.has(g.product_id)) latest.set(g.product_id, g);
  }
  const published = new Map<string, string>();
  for (const im of (imgs as { product_id: string; url: string }[] | null) ??
    []) {
    if (!published.has(im.product_id)) published.set(im.product_id, im.url);
  }

  const statuses: ImageStatus[] = ids.map((productId) => {
    const g = latest.get(productId);
    return {
      productId,
      status: (g?.status as ImageStatus["status"]) ?? "none",
      published: published.get(productId) ?? null,
      resultUrl: g?.result_url ?? null,
      generationId: g?.id ?? null,
      prompt: g?.prompt ?? "",
      error: g?.error ?? null,
    };
  });

  return NextResponse.json({ statuses });
}

import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffUser } from "@/lib/auth/guard";

export interface GenerationRow {
  id: string;
  status: "pending" | "generating" | "done" | "failed";
  prompt: string;
  resultUrl: string | null;
  error: string | null;
  createdAt: string;
}

/** Generation history for a product (popup history / revert, §9). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isSupabaseConfigured) return NextResponse.json({ generations: [] });
  const staff = await getStaffUser();
  if (!staff) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: "NO_DB" }, { status: 500 });

  const { data } = await supabase
    .from("product_image_generations")
    .select("id, status, prompt, result_url, error, created_at")
    .eq("product_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

  const generations: GenerationRow[] = (
    (data as
      | {
          id: string;
          status: GenerationRow["status"];
          prompt: string;
          result_url: string | null;
          error: string | null;
          created_at: string;
        }[]
      | null) ?? []
  ).map((g) => ({
    id: g.id,
    status: g.status,
    prompt: g.prompt,
    resultUrl: g.result_url,
    error: g.error,
    createdAt: g.created_at,
  }));

  return NextResponse.json({ generations });
}

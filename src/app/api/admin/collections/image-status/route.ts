import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffUser } from "@/lib/auth/guard";

export interface CollectionImageStatus {
  collectionId: string;
  /** Дараалалд эсвэл үүсч байгаа ажил байгаа эсэх. */
  busy: boolean;
  imageUrl: string | null;
}

/**
 * Хэд хэдэн багцын AI зургийн төлөв (админы багцын жагсаалт). Барааны
 * `products/image-status`-ийн ихэр. Одоогийн зургийг хамт буцаадаг нь —
 * зураггүй багцад үр дүн автоматаар хадгалагддаг тул жагсаалт түүнийг
 * хуудсыг дахин ачаалалгүй харуулна.
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

  const [{ data: jobs }, { data: cols }] = await Promise.all([
    supabase
      .from("collection_image_generations")
      .select("collection_id")
      .in("collection_id", ids)
      .in("status", ["pending", "generating"]),
    supabase.from("collections").select("id, image_url").in("id", ids),
  ]);

  const busy = new Set(
    ((jobs ?? []) as { collection_id: string }[]).map((j) => j.collection_id),
  );
  const images = new Map(
    ((cols ?? []) as { id: string; image_url: string | null }[]).map((c) => [
      c.id,
      c.image_url,
    ]),
  );

  const statuses: CollectionImageStatus[] = ids.map((collectionId) => ({
    collectionId,
    busy: busy.has(collectionId),
    imageUrl: images.get(collectionId) ?? null,
  }));
  return NextResponse.json({ statuses });
}

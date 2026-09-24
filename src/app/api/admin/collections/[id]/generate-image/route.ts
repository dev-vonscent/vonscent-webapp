import { NextResponse, after } from "next/server";
import { isSupabaseConfigured, isImageGenConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffUser } from "@/lib/auth/guard";
import { buildCollectionImagePrompt } from "@/lib/ai/collection-image-prompt";
import { processCollectionGeneration } from "@/lib/ai/process-collection-generation";

/** Зураг үүсэх нь хариу буцсаны дараа (`after()`) үргэлжилнэ. */
export const maxDuration = 300;

/** Засах хуудсанд харуулах сүүлийн оролдлогууд. */
const HISTORY_LIMIT = 12;

export interface CollectionImageJob {
  id: string;
  status: "pending" | "generating" | "done" | "failed";
  result_url: string | null;
  error: string | null;
  created_at: string;
}

interface CollectionRow {
  name: string;
  gender: string;
  description: string | null;
  collection_items: {
    product_id: string;
    sort_order: number;
    products: {
      name: string;
      brand: string | null;
      reference_image_url: string | null;
    } | null;
  }[];
}

/**
 * Багцын poster-ийг AI-аар үүсгэх (админы багц засах хуудас).
 *
 * Барааны `generate-image`-тэй ижил урсгал: ажил дараалалд орж, `after()`
 * дотор үүсэж, UI нь GET-ээр 4 секунд тутам шалгана. Prompt, лавлахыг сервер
 * өөрөө бүрдүүлнэ — ХАДГАЛСАН багцын нэр/тайлбар/гишүүд, гишүүн бүрийн
 * үндсэн зураг (галерейд харагдаж байгаагийн эхнийх, эс бөгөөс лавлах сав).
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isSupabaseConfigured || !isImageGenConfigured) {
    return NextResponse.json({ error: "UNAVAILABLE" }, { status: 503 });
  }
  const staff = await getStaffUser();
  if (!staff) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: "NO_DB" }, { status: 500 });

  const { data } = await supabase
    .from("collections")
    .select(
      "name, gender, description, collection_items(product_id, sort_order, products(name, brand, reference_image_url))",
    )
    .eq("id", id)
    .eq("type", "base")
    .maybeSingle();
  const collection = data as CollectionRow | null;
  if (!collection)
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const items = [...collection.collection_items].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  const productIds = items.map((i) => i.product_id);

  const { data: imageRows } = await supabase
    .from("product_images")
    .select("product_id, url, is_visible, sort_order")
    .in("product_id", productIds.length ? productIds : [id])
    .order("sort_order", { ascending: true });
  const images = (imageRows ?? []) as {
    product_id: string;
    url: string;
    is_visible: boolean;
  }[];

  // Гишүүн бүрийн үндсэн зураг; зураггүй гишүүнийг алгасахгүй, бүхэлд нь
  // татгалзана — дутуу лавлахтай бол загвар савыг зохиож зурдаг.
  const members: { brand: string | null; name: string; url: string }[] = [];
  const missing: string[] = [];
  for (const item of items) {
    const own = images.filter((r) => r.product_id === item.product_id);
    const url =
      (own.find((r) => r.is_visible) ?? own[0])?.url ??
      item.products?.reference_image_url ??
      null;
    const name = item.products?.name ?? item.product_id;
    if (url) members.push({ brand: item.products?.brand ?? null, name, url });
    else missing.push(name);
  }
  if (!members.length || missing.length) {
    return NextResponse.json(
      { error: "NO_REFERENCE", missing },
      { status: 400 },
    );
  }

  const prompt = buildCollectionImagePrompt({
    name: collection.name,
    gender: collection.gender,
    description: collection.description ?? "",
    members,
  });

  const { data: job, error } = await supabase
    .from("collection_image_generations")
    .insert({
      collection_id: id,
      status: "pending",
      prompt,
      reference_urls: members.map((m) => m.url),
    })
    .select("id")
    .single();
  if (error || !job) {
    return NextResponse.json({ error: "ENQUEUE_FAILED" }, { status: 500 });
  }

  const jobId = (job as { id: string }).id;
  after(() => processCollectionGeneration(jobId));
  return NextResponse.json({ jobId });
}

/** Энэ багцын сүүлийн оролдлогууд, шинэ нь эхэндээ. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isSupabaseConfigured) return NextResponse.json({ jobs: [] });
  const staff = await getStaffUser();
  if (!staff) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: "NO_DB" }, { status: 500 });

  const { data } = await supabase
    .from("collection_image_generations")
    .select("id, status, result_url, error, created_at")
    .eq("collection_id", id)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);
  return NextResponse.json({ jobs: (data ?? []) as CollectionImageJob[] });
}

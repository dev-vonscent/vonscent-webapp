import { NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { getStaffUser } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  deleteImage,
  isStorageUrl,
  storagePath,
  uploadImage,
} from "@/lib/storage/storage";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/storage/limits";
import { processImage, presetForFolder } from "@/lib/storage/process-image";

/**
 * The bottle photo every generation works from (`products.reference_image_url`,
 * 0031). It is deliberately not a gallery row: the storefront never shows it,
 * and regenerate-image prefers it over anything else precisely because it never
 * changes underneath a product — so swapping it is its own explicit action.
 *
 * POST uploads a replacement (multipart, field `file`) or adopts one of the
 * product's own storage URLs (JSON `{ url }`, for "use this gallery image").
 * DELETE clears it. The previous object is removed only when it was a reference
 * upload of ours — a URL shared with the gallery must outlive the reference.
 */

const REF_PREFIX = "ref-";

type Guard =
  | { demo: true }
  | { error: "FORBIDDEN" | "NO_DB" }
  | { supabase: NonNullable<ReturnType<typeof createAdminClient>> };

async function guard(): Promise<Guard> {
  if (!isSupabaseConfigured) return { demo: true };
  if (!(await getStaffUser())) return { error: "FORBIDDEN" };
  const supabase = createAdminClient();
  if (!supabase) return { error: "NO_DB" };
  return { supabase };
}

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

/**
 * Drop the object behind the outgoing reference, but only if nothing else
 * points at it: a gallery image adopted as the reference is still the
 * storefront's picture.
 */
async function discardOldReference(
  supabase: NonNullable<ReturnType<typeof createAdminClient>>,
  productId: string,
  previous: string | null,
  next: string | null,
) {
  if (!previous || previous === next) return;
  const path = storagePath(previous);
  if (!path || !path.split("/").pop()?.startsWith(REF_PREFIX)) return;

  const { data: used } = await supabase
    .from("product_images")
    .select("id")
    .eq("product_id", productId)
    .eq("url", previous)
    .maybeSingle();
  if (used) return;

  await deleteImage(path);
}

const adoptSchema = z.object({ url: z.string().url().max(2048) });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guard();
  if ("demo" in g) return NextResponse.json({ demo: true });
  if ("error" in g) return fail(g.error, g.error === "FORBIDDEN" ? 403 : 500);
  const { supabase } = g;

  const { data: current } = await supabase
    .from("products")
    .select("reference_image_url")
    .eq("id", id)
    .maybeSingle();
  if (!current) return fail("NOT_FOUND", 404);
  const previous =
    (current as { reference_image_url: string | null }).reference_image_url ??
    null;

  let url: string;

  if (req.headers.get("content-type")?.includes("application/json")) {
    // Adopt an image the product already owns — no second copy in storage.
    const parsed = adoptSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail("VALIDATION", 400);
    if (!isStorageUrl(parsed.data.url)) return fail("BAD_URL", 400);
    url = parsed.data.url;
  } else {
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return fail("NO_FILE", 400);
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return fail("BAD_TYPE", 400);
    if (file.size > MAX_IMAGE_BYTES) return fail("TOO_LARGE", 400);

    const image = await processImage(
      await file.arrayBuffer(),
      presetForFolder("products"),
    );
    if (!image) return fail("BAD_IMAGE", 400);

    const uploaded = await uploadImage(
      `products/${id}/${REF_PREFIX}${crypto.randomUUID()}.${image.ext}`,
      image.data,
      image.contentType,
    );
    if (!uploaded) return fail("UPLOAD_FAILED", 500);
    url = uploaded.url;
  }

  const { error } = await supabase
    .from("products")
    .update({ reference_image_url: url })
    .eq("id", id);
  if (error) return fail("UPDATE_FAILED", 500);

  await discardOldReference(supabase, id, previous, url);
  // No revalidatePublic(): the reference never reaches the storefront.
  return NextResponse.json({ url });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guard();
  if ("demo" in g) return NextResponse.json({ demo: true });
  if ("error" in g) return fail(g.error, g.error === "FORBIDDEN" ? 403 : 500);
  const { supabase } = g;

  const { data: current } = await supabase
    .from("products")
    .select("reference_image_url")
    .eq("id", id)
    .maybeSingle();
  if (!current) return fail("NOT_FOUND", 404);
  const previous =
    (current as { reference_image_url: string | null }).reference_image_url ??
    null;

  const { error } = await supabase
    .from("products")
    .update({ reference_image_url: null })
    .eq("id", id);
  if (error) return fail("UPDATE_FAILED", 500);

  await discardOldReference(supabase, id, previous, null);
  return NextResponse.json({ ok: true });
}

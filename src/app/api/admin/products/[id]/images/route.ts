import { NextResponse } from "next/server";
import { revalidatePublic } from "@/lib/cache";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { getStaffUser } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteImage, storagePath, uploadImage } from "@/lib/storage/storage";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/storage/limits";
import { processImage, presetForFolder } from "@/lib/storage/process-image";

/**
 * Gallery of an existing product (todo.md B3). POST uploads a file and appends
 * it, PATCH rewrites order/alt text, DELETE removes a row and its object.
 * Staff only — the storefront reads product_images through the public select.
 */

const MAX_IMAGES = 12;

type Guard =
  | { demo: true }
  | { error: "FORBIDDEN" | "NO_DB" }
  | { supabase: NonNullable<ReturnType<typeof createAdminClient>> };

async function guard(): Promise<Guard> {
  if (!isSupabaseConfigured) return { demo: true };
  const staff = await getStaffUser();
  if (!staff) return { error: "FORBIDDEN" };
  const supabase = createAdminClient();
  if (!supabase) return { error: "NO_DB" };
  return { supabase };
}

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

/** The gallery as it stands, for a client that has fallen behind — the studio
 *  after a background generation filed its result as a row (0049). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guard();
  if ("demo" in g) return NextResponse.json({ images: [] });
  if ("error" in g) return fail(g.error, g.error === "FORBIDDEN" ? 403 : 500);

  const { data } = await g.supabase
    .from("product_images")
    .select("id, url, alt, sort_order, is_visible")
    .eq("product_id", id)
    .order("sort_order", { ascending: true });

  return NextResponse.json({
    images: (
      (data as
        | {
            id: string;
            url: string;
            alt: string | null;
            is_visible: boolean;
          }[]
        | null) ?? []
    ).map((r) => ({
      id: r.id,
      url: r.url,
      alt: r.alt ?? "",
      visible: r.is_visible,
    })),
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guard();
  if ("demo" in g) return NextResponse.json({ demo: true });
  if ("error" in g) return fail(g.error, g.error === "FORBIDDEN" ? 403 : 500);
  const { supabase } = g;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return fail("NO_FILE", 400);
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return fail("BAD_TYPE", 400);
  if (file.size > MAX_IMAGE_BYTES) return fail("TOO_LARGE", 400);

  // Append to the end of the gallery, and refuse to grow it without bound.
  const { data: existing } = await supabase
    .from("product_images")
    .select("sort_order")
    .eq("product_id", id)
    .order("sort_order", { ascending: false });
  const rows = (existing as { sort_order: number }[] | null) ?? [];
  if (rows.length >= MAX_IMAGES) return fail("TOO_MANY", 400);
  const nextOrder = rows.length ? rows[0].sort_order + 1 : 0;

  // Re-encoded to a bounded WebP, so the extension comes from the processed
  // image rather than whatever the client happened to name the file.
  const image = await processImage(
    await file.arrayBuffer(),
    presetForFolder("products"),
  );
  if (!image) return fail("BAD_IMAGE", 400);

  const uploaded = await uploadImage(
    `products/${id}/${crypto.randomUUID()}.${image.ext}`,
    image.data,
    image.contentType,
  );
  if (!uploaded) return fail("UPLOAD_FAILED", 500);

  const { data, error } = await supabase
    .from("product_images")
    .insert({
      product_id: id,
      url: uploaded.url,
      alt: (form?.get("alt") as string) || "",
      sort_order: nextOrder,
    })
    .select("id, url, alt, sort_order, is_visible")
    .single();
  if (error || !data) {
    // Don't leave the object behind when the row didn't land.
    await deleteImage(uploaded.path);
    return fail("INSERT_FAILED", 500);
  }
  return NextResponse.json(data);
}

const patchSchema = z.object({
  images: z
    .array(
      z.object({
        id: z.string().uuid(),
        alt: z.string().max(200).default(""),
        sortOrder: z.number().int().nonnegative(),
        /** The admin's storefront selection (0049). */
        isVisible: z.boolean().default(true),
      }),
    )
    .max(MAX_IMAGES),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION", 400);

  const g = await guard();
  if ("demo" in g) return NextResponse.json({ demo: true });
  if ("error" in g) return fail(g.error, g.error === "FORBIDDEN" ? 403 : 500);

  // Scoped by product_id as well as id, so one product's payload can't
  // reorder another's gallery.
  for (const img of parsed.data.images) {
    await g.supabase
      .from("product_images")
      .update({
        alt: img.alt,
        sort_order: img.sortOrder,
        is_visible: img.isVisible,
      })
      .eq("id", img.id)
      .eq("product_id", id);
  }
  revalidatePublic();
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const imageId = new URL(req.url).searchParams.get("imageId");
  if (!imageId) return fail("NO_IMAGE", 400);

  const g = await guard();
  if ("demo" in g) return NextResponse.json({ demo: true });
  if ("error" in g) return fail(g.error, g.error === "FORBIDDEN" ? 403 : 500);

  const { data } = await g.supabase
    .from("product_images")
    .select("url")
    .eq("id", imageId)
    .eq("product_id", id)
    .maybeSingle();
  const row = data as { url: string } | null;
  if (!row) return fail("NOT_FOUND", 404);

  const { error } = await g.supabase
    .from("product_images")
    .delete()
    .eq("id", imageId)
    .eq("product_id", id);
  if (error) return fail("DELETE_FAILED", 500);

  // The row is the record of truth; a stray object is harmless, so a failed
  // storage delete doesn't fail the request.
  const path = storagePath(row.url);
  if (path) await deleteImage(path);

  revalidatePublic();
  return NextResponse.json({ ok: true });
}

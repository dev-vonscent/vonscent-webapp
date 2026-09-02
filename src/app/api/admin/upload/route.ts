import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getStaffUser } from "@/lib/auth/guard";
import { uploadImage } from "@/lib/storage/storage";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/storage/limits";
import { processImage, presetForFolder } from "@/lib/storage/process-image";
import { imageUploadFailure } from "@/lib/storage/report";

/** Upload a product/blog image to Supabase Storage. Staff only. */
async function handle(req: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ demo: true });
  }

  const staff = await getStaffUser();
  if (!staff) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const folder = (form?.get("folder") as string) || "products";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "NO_FILE" }, { status: 400 });
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "BAD_TYPE" }, { status: 400 });
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "TOO_LARGE" }, { status: 400 });
  }

  // Re-encoded to a bounded WebP, so the extension comes from the processed
  // image rather than whatever the client happened to name the file.
  const image = await processImage(
    await file.arrayBuffer(),
    presetForFolder(folder),
  );
  if (!image) {
    return NextResponse.json({ error: "BAD_IMAGE" }, { status: 400 });
  }

  const path = `${folder}/${crypto.randomUUID()}.${image.ext}`;
  const result = await uploadImage(path, image.data, image.contentType);
  if (!result) {
    return NextResponse.json({ error: "UPLOAD_FAILED" }, { status: 500 });
  }

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  try {
    return await handle(req);
  } catch (err) {
    return imageUploadFailure(err);
  }
}

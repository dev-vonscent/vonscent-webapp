import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { getStaffUser } from "@/lib/auth/guard";
import { uploadImage } from "@/lib/storage/storage";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/storage/limits";
import { processImage, presetForFolder } from "@/lib/storage/process-image";

/**
 * Image upload to Supabase Storage. Auth required.
 *
 * The upload runs under the service role, which bypasses the bucket's staff
 * write policy — so the folder decides who may write where rather than being
 * a free-text field any signed-in customer can point at product content.
 */
const FOLDERS = {
  avatars: "customer",
  /** Staging area for a product being created; see admin products POST. */
  "products/new": "staff",
  /** Scent family icons (todo.md B3b) — shown on the home rail and filters. */
  families: "staff",
  blog: "staff",
} as const;

type Folder = keyof typeof FOLDERS;

function isFolder(value: string): value is Folder {
  return value in FOLDERS;
}

export async function POST(req: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ demo: true });
  }

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "NO_DB" }, { status: 500 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const folder = (form?.get("folder") as string) || "avatars";

  if (!isFolder(folder)) {
    return NextResponse.json({ error: "BAD_FOLDER" }, { status: 400 });
  }
  if (FOLDERS[folder] === "staff" && !(await getStaffUser())) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
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

  const path = `${folder}/${user.id}-${crypto.randomUUID()}.${image.ext}`;
  const result = await uploadImage(path, image.data, image.contentType);
  if (!result) {
    return NextResponse.json({ error: "UPLOAD_FAILED" }, { status: 500 });
  }
  return NextResponse.json(result);
}

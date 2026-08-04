import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

/**
 * Image storage on **Supabase Storage** (public bucket). Server-only — uploads
 * use the service-role client. The bucket name comes from env (default
 * `product-images`) and is created by migration 0011_storage.sql.
 */
export const STORAGE_BUCKET = env.storageBucket;

/** Public URL for an object path within the bucket. */
export function publicUrl(path: string): string {
  return `${env.supabaseUrl}/storage/v1/object/public/${STORAGE_BUCKET}/${path}`;
}

/** True when `url` is a public object in our own bucket. */
export function isStorageUrl(url: string): boolean {
  return url.startsWith(publicUrl(""));
}

/**
 * Object path behind a public URL, or null when it isn't one of ours — the
 * inverse of publicUrl(), used to delete the object behind a gallery row.
 */
export function storagePath(url: string): string | null {
  const prefix = publicUrl("");
  return url.startsWith(prefix) ? url.slice(prefix.length) : null;
}

export interface UploadResult {
  path: string;
  url: string;
}

/**
 * Upload an image and return its public URL. `path` should be a unique key,
 * e.g. `products/<slug>/<uuid>.jpg`.
 */
export async function uploadImage(
  path: string,
  file: ArrayBuffer | Uint8Array | Blob,
  contentType: string,
): Promise<UploadResult | null> {
  const supabase = createAdminClient();
  if (!supabase) return null;

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, { contentType, upsert: true });
  if (error) return null;

  return { path, url: publicUrl(path) };
}

export async function deleteImage(path: string): Promise<boolean> {
  const supabase = createAdminClient();
  if (!supabase) return false;
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .remove([path]);
  return !error;
}

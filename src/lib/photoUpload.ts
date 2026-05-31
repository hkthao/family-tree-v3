import imageCompression from "browser-image-compression";

import { supabase } from "@/lib/supabase";

/**
 * Person-photo upload pipeline.
 *
 * Storage layout: `person-photos/{clan_id}/{person_id}.jpg` — a single
 * file per person, always JPEG, always overwrite. That gives us
 * automatic dedupe (no orphaned files when a user re-uploads) and a
 * stable `photo_path` we can cache.
 *
 * Compression targets: ≤ 512×512, ≤ 80 KB, quality 0.8. At ~80 KB per
 * photo a 1 GB project bucket fits ~12 000 avatars — enough for tens
 * of clans.
 */

const BUCKET = "person-photos";
const MAX_DIMENSION = 512;
const TARGET_BYTES = 80 * 1024;

export interface UploadResult {
  /** Storage path (also written to persons.photo_path). */
  path: string;
  /** Compressed file size in bytes — useful for the success toast. */
  bytes: number;
}

/**
 * Compress an image (resize + JPEG re-encode) and upload to the
 * person's storage slot. Returns the persisted storage path on
 * success.
 *
 * Caller is responsible for updating `persons.photo_path = result.path`
 * — done separately so the storage upload + DB write can be wrapped in
 * a single mutation.
 */
export async function uploadPersonPhoto(
  clanId: string,
  personId: string,
  file: File,
): Promise<UploadResult> {
  if (!file.type.startsWith("image/")) {
    throw new Error("File phải là ảnh (JPG / PNG / WebP / HEIC)");
  }

  const compressed = await imageCompression(file, {
    maxSizeMB: TARGET_BYTES / 1024 / 1024,
    maxWidthOrHeight: MAX_DIMENSION,
    useWebWorker: true,
    initialQuality: 0.8,
    fileType: "image/jpeg",
  });

  const path = `${clanId}/${personId}.jpg`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, compressed, {
      cacheControl: "3600",
      upsert: true,
      contentType: "image/jpeg",
    });
  if (error) throw new Error(`upload: ${error.message}`);

  return { path, bytes: compressed.size };
}

/**
 * Build a short-lived signed URL for displaying the photo. The bucket
 * is private (only clan members can SELECT), so plain public URLs
 * return 401. Signed URLs carry a token that bypasses the auth header
 * requirement, which `<img>` tags can't supply.
 *
 * Returns null if `photoPath` is empty/null so callers can fall back
 * to the gendered illustration.
 */
export async function getSignedPhotoUrl(
  photoPath: string | null | undefined,
  expiresInSec = 3600,
): Promise<string | null> {
  if (!photoPath) return null;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(photoPath, expiresInSec);
  if (error) return null;
  return data?.signedUrl ?? null;
}

/**
 * Batched signed-URL fetch for a page of photos. One round-trip for
 * the whole list — cheaper than N parallel `createSignedUrl` calls
 * when listing 50-100 persons at once. Returns a Map keyed by the
 * original photo_path; paths that failed to sign are absent.
 */
export async function getSignedPhotoUrlMap(
  photoPaths: string[],
  expiresInSec = 3600,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const cleaned = [...new Set(photoPaths.filter(Boolean))];
  if (cleaned.length === 0) return out;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(cleaned, expiresInSec);
  if (error || !data) return out;
  for (const entry of data) {
    if (entry.signedUrl && entry.path) out.set(entry.path, entry.signedUrl);
  }
  return out;
}

/**
 * Delete a person's photo from storage. Used by the editor's "Xoá ảnh"
 * action. Idempotent: missing object returns success.
 */
export async function deletePersonPhoto(
  photoPath: string,
): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([photoPath]);
  if (error) throw new Error(`delete: ${error.message}`);
}

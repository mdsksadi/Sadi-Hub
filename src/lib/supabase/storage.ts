import { getSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const PUBLIC_BUCKET = "portfolio";
export const PRIVATE_BUCKET = "documents";

export function publicObjectUrl(
  bucket: string,
  path: string | null,
): string | null {
  const env = getSupabaseEnv();
  if (!env || !path) return null;
  return `${env.url}/storage/v1/object/public/${bucket}/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

/** Server-only: never render the returned URL into public HTML. */
export async function signedObjectUrl(
  bucket: string,
  path: string,
  expiresIn = 120,
): Promise<string | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, Math.min(300, Math.max(60, expiresIn)));
  if (error || !data) return null;
  return data.signedUrl;
}

export function storagePathFor(ownerId: string, fileName: string): string {
  const safe = fileName
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .slice(-120);
  return `${ownerId}/${crypto.randomUUID()}-${safe}`;
}

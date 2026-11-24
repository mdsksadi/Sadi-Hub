const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const rawSupabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const siteUrl = rawSiteUrl.replace(/\/$/, "");

export function getSupabaseEnv(): { url: string; key: string } | null {
  if (!rawSupabaseUrl || !rawSupabaseKey) return null;
  return { url: rawSupabaseUrl, key: rawSupabaseKey };
}

export const hasSupabaseEnv = getSupabaseEnv() !== null;

export function absoluteUrl(path: string): string {
  return `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

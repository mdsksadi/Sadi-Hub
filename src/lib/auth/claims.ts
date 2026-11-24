import { createClient } from "@/lib/supabase/server";

export type VerifiedClaims = {
  sub?: string;
  email?: string;
  role?: string;
  aal?: string;
  amr?: Array<{ method: string; timestamp?: number }>;
  [key: string]: unknown;
};

/** Verified JWT claims. getSession() is deliberately never used here. */
export async function getVerifiedClaims(): Promise<VerifiedClaims | null> {
  const supabase = await createClient();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) return null;
  return data.claims as VerifiedClaims;
}

export function hasMfa(claims: VerifiedClaims | null): boolean {
  return claims?.aal === "aal2";
}

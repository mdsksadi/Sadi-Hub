import { redirect } from "next/navigation";
import { getVerifiedClaims, hasMfa } from "@/lib/auth/claims";
import { createClient } from "@/lib/supabase/server";

export type OwnerContext = {
  userId: string;
  email: string;
  displayName: string;
  claims: NonNullable<Awaited<ReturnType<typeof getVerifiedClaims>>>;
};

async function resolveOwner(requireMfa: boolean): Promise<OwnerContext | null> {
  const claims = await getVerifiedClaims();
  if (!claims?.sub || claims.role !== "authenticated") return null;
  if (requireMfa && !hasMfa(claims)) return null;

  const supabase = await createClient();
  if (!supabase) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, display_name, role, status")
    .eq("id", claims.sub)
    .maybeSingle();

  if (!profile || profile.role !== "owner" || profile.status !== "active") {
    return null;
  }

  return {
    userId: profile.id,
    email: profile.email,
    displayName: profile.display_name,
    claims,
  };
}

/** MFA-verified owner context for all private admin routes and mutations. */
export async function getOwnerContext(): Promise<OwnerContext | null> {
  return resolveOwner(true);
}

/**
 * aal1 owner context used only to enroll the very first TOTP factor. It cannot
 * access portfolio data or admin pages; callers must redirect verified users.
 */
export async function getOwnerSetupContext(): Promise<OwnerContext | null> {
  return resolveOwner(false);
}

/** Use in every private Server Component and mutation entry point. */
export async function requireOwner(): Promise<OwnerContext> {
  const owner = await getOwnerContext();
  if (!owner) {
    redirect("/admin/login?reason=unauthorized");
  }
  return owner;
}

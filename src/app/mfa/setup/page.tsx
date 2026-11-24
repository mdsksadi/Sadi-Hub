import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MfaEnrollForm } from "@/components/mfa-enroll-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getOwnerSetupContext } from "@/lib/auth/owner";
import { createClient } from "@/lib/supabase/server";
import { confirmSetupEnrollment, startSetupEnrollment } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Set up MFA",
  robots: { index: false, follow: false },
};

/**
 * One-time setup path for a brand-new owner. It is deliberately outside /admin
 * so aal1 users can enroll their first TOTP factor without locking themselves
 * out of every MFA-gated route.
 */
export default async function MfaSetupPage() {
  const owner = await getOwnerSetupContext();
  if (!owner) redirect("/admin/login?reason=unauthorized");

  const supabase = await createClient();
  if (!supabase) redirect("/admin/login?reason=config");

  const { data: factors } = await supabase.auth.mfa.listFactors();
  if (factors?.totp.some((factor) => factor.status === "verified")) {
    redirect("/admin/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-2xl">
            Set up two-factor authentication
          </CardTitle>
          <p className="text-muted-foreground text-sm">
            Signed in as {owner.email}. Enroll an authenticator app to unlock
            the admin area.
          </p>
        </CardHeader>
        <CardContent>
          <MfaEnrollForm
            startAction={startSetupEnrollment}
            confirmAction={confirmSetupEnrollment}
          />
        </CardContent>
      </Card>
    </main>
  );
}

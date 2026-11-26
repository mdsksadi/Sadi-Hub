"use server";

import { redirect } from "next/navigation";
import type { EnrollmentFormState } from "@/lib/auth/mfa-state";
import { hasMfa } from "@/lib/auth/claims";
import { getOwnerSetupContext } from "@/lib/auth/owner";
import { createClient } from "@/lib/supabase/server";
import { qrSvgToDataUrl } from "@/lib/security/mfa";
import { formText } from "@/lib/validation/forms";
import { mfaSchema } from "@/lib/validation/schemas";

export type SetupState = EnrollmentFormState;

async function setupClient() {
  const owner = await getOwnerSetupContext();
  if (!owner) redirect("/admin/login?reason=unauthorized");
  if (hasMfa(owner.claims)) redirect("/admin/dashboard");

  const supabase = await createClient(true);
  if (!supabase) return null;
  return supabase;
}

export async function startSetupEnrollment(): Promise<SetupState> {
  const supabase = await setupClient();
  if (!supabase)
    return { status: "error", message: "Authentication is not configured." };

  // `mfa.listFactors()` only returns verified factors. Read the full factor
  // list from the user so abandoned unverified factors can be cleaned up;
  // otherwise GoTrue rejects a new factor with the same friendly name.
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user)
    return { status: "error", message: "Could not load MFA factors." };
  const factors = userData.user.factors ?? [];
  if (
    factors.some(
      (factor) => factor.factor_type === "totp" && factor.status === "verified",
    )
  ) {
    redirect("/admin/dashboard");
  }

  for (const factor of factors) {
    if (factor.status === "verified") continue;
    const { error: unenrollError } = await supabase.auth.mfa.unenroll({
      factorId: factor.id,
    });
    if (unenrollError)
      return { status: "error", message: "Could not reset MFA enrollment." };
  }

  const { data: enrolled, error: enrollError } = await supabase.auth.mfa.enroll(
    {
      factorType: "totp",
      friendlyName: "Sadi Hub",
    },
  );
  if (enrollError || !enrolled || !("totp" in enrolled)) {
    return { status: "error", message: "Could not start MFA enrollment." };
  }

  const { data: challenge, error: challengeError } =
    await supabase.auth.mfa.challenge({
      factorId: enrolled.id,
    });
  if (challengeError || !challenge) {
    return { status: "error", message: "Could not create an MFA challenge." };
  }

  return {
    status: "idle",
    qrCode: qrSvgToDataUrl(enrolled.totp.qr_code),
    secret: enrolled.totp.secret,
    factorId: enrolled.id,
    challengeId: challenge.id,
    message: "Scan the QR code, then enter a code to finish setup.",
  };
}

export async function confirmSetupEnrollment(
  _state: SetupState,
  formData: FormData,
): Promise<SetupState> {
  const supabase = await setupClient();
  if (!supabase)
    return { status: "error", message: "Authentication is not configured." };

  const parsed = mfaSchema.safeParse({
    factorId: formText(formData, "factorId"),
    challengeId: formText(formData, "challengeId"),
    code: formText(formData, "code"),
  });
  if (!parsed.success)
    return { status: "error", message: "Enter a valid 6-digit code." };

  const { error } = await supabase.auth.mfa.verify(parsed.data);
  if (error) return { status: "error", message: "That code did not match." };

  redirect("/admin/dashboard");
}

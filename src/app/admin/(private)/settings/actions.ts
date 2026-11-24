"use server";

import type { EnrollmentFormState } from "@/lib/auth/mfa-state";
import { requireOwner } from "@/lib/auth/owner";
import { createClient } from "@/lib/supabase/server";
import { qrSvgToDataUrl } from "@/lib/security/mfa";
import { formText } from "@/lib/validation/forms";
import { mfaSchema } from "@/lib/validation/schemas";

export type EnrollmentState = EnrollmentFormState;

export async function startEnrollment(): Promise<EnrollmentState> {
  await requireOwner();
  const supabase = await createClient(true);
  if (!supabase)
    return { status: "error", message: "Authentication is not configured." };

  const { data: factors } = await supabase.auth.mfa.listFactors();
  if (factors?.totp.some((factor) => factor.status === "verified")) {
    return {
      status: "success",
      message: "An authenticator app is already enrolled.",
    };
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
    message: "Scan the QR code, then enter a code to finish enrollment.",
  };
}

export async function confirmEnrollment(
  _state: EnrollmentState,
  formData: FormData,
): Promise<EnrollmentState> {
  await requireOwner();
  const parsed = mfaSchema.safeParse({
    factorId: formText(formData, "factorId"),
    challengeId: formText(formData, "challengeId"),
    code: formText(formData, "code"),
  });
  if (!parsed.success)
    return { status: "error", message: "Enter a valid 6-digit code." };

  const supabase = await createClient(true);
  if (!supabase)
    return { status: "error", message: "Authentication is not configured." };

  const { error } = await supabase.auth.mfa.verify(parsed.data);
  if (error) return { status: "error", message: "That code did not match." };
  return {
    status: "success",
    message: "Authenticator app enrolled and verified.",
  };
}

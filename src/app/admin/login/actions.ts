"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formText } from "@/lib/validation/forms";
import {
  loginSchema,
  mfaSchema,
  type FormState,
} from "@/lib/validation/schemas";

export type LoginState = FormState & {
  factorId?: string;
  challengeId?: string;
};

const genericError = "Invalid email or password.";

export async function signIn(
  _state: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formText(formData, "email"),
    password: formData.get("password") ?? "",
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Enter a valid email and a password of at least 12 characters.",
    };
  }

  const supabase = await createClient(true);
  if (!supabase)
    return { status: "error", message: "Authentication is not configured." };

  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { status: "error", message: genericError };

  const { data: factors, error: factorsError } =
    await supabase.auth.mfa.listFactors();
  if (factorsError)
    return { status: "error", message: "Could not load MFA factors." };

  const factor = factors?.totp.find((item) => item.status === "verified");
  if (!factor) {
    // First-time owners can enroll their first factor here; after that, all
    // admin routes require the aal2 claim.
    redirect("/mfa/setup");
  }

  const { data: challenge, error: challengeError } =
    await supabase.auth.mfa.challenge({
      factorId: factor.id,
    });
  if (challengeError || !challenge) {
    return { status: "error", message: "Could not start MFA verification." };
  }

  return {
    status: "idle",
    factorId: factor.id,
    challengeId: challenge.id,
  };
}

export async function verifyMfa(
  _state: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = mfaSchema.safeParse({
    factorId: formText(formData, "factorId"),
    challengeId: formText(formData, "challengeId"),
    code: formText(formData, "code"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Enter the 6-digit code from your authenticator app.",
    };
  }

  const supabase = await createClient(true);
  if (!supabase)
    return { status: "error", message: "Authentication is not configured." };

  const { error } = await supabase.auth.mfa.verify(parsed.data);
  if (error)
    return { status: "error", message: "That code is invalid or has expired." };

  redirect("/admin/dashboard");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient(true);
  await supabase?.auth.signOut();
  redirect("/admin/login");
}

"use server";

import { requireOwner } from "@/lib/auth/owner";
import { revalidateDonations } from "@/lib/admin/finance-revalidate";
import { correctDonation, createDonation } from "@/lib/services/donations";
import { friendlyRpcError } from "@/lib/services/rpc-error";
import { formText } from "@/lib/validation/forms";
import {
  donationCorrectionSchema,
  donationSchema,
  type FormState,
} from "@/lib/validation/donations";

function failure(message: string): FormState {
  return { status: "error", message };
}

function success(message: string): FormState {
  revalidateDonations();
  return { status: "success", message };
}

function caught(error: unknown, fallback: string): FormState {
  return failure(friendlyRpcError(error, fallback));
}

export async function createDonationAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireOwner();

  const parsed = donationSchema.safeParse({
    contactId: formText(formData, "contactId"),
    recipientName: formText(formData, "recipientName"),
    recipientType: formText(formData, "recipientType"),
    amount: formText(formData, "amount"),
    currencyCode: formText(formData, "currencyCode"),
    donationDate: formText(formData, "donationDate"),
    sourceAccountId: formText(formData, "sourceAccountId"),
    purpose: formText(formData, "purpose"),
    categoryId: formText(formData, "categoryId"),
    countryCode: formText(formData, "countryCode"),
    paymentMethod: formText(formData, "paymentMethod"),
    referenceNumber: formText(formData, "referenceNumber"),
    notes: formText(formData, "notes"),
  });
  if (!parsed.success) {
    return failure(
      `Check the donation fields: ${parsed.error.issues[0]?.message ?? "invalid value"}`,
    );
  }

  try {
    await createDonation(parsed.data);
    return success("Donation recorded.");
  } catch (error) {
    return caught(error, "Could not record the donation. Try again.");
  }
}

export async function correctDonationAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireOwner();

  const parsed = donationCorrectionSchema.safeParse({
    donationId: formText(formData, "donationId"),
    correctionType: formText(formData, "correctionType"),
    amount: formText(formData, "amount"),
    reason: formText(formData, "reason"),
  });
  if (!parsed.success) {
    return failure(
      `Check the correction fields: ${parsed.error.issues[0]?.message ?? "invalid value"}`,
    );
  }

  try {
    await correctDonation(parsed.data);
    return success("Correction recorded.");
  } catch (error) {
    return caught(error, "Could not record the correction. Try again.");
  }
}

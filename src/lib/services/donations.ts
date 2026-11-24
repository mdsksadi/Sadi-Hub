import { createClient } from "@/lib/supabase/server";
import type {
  DonationCorrectionInput,
  DonationInput,
} from "@/lib/validation/donations";
import { friendlyRpcError } from "./rpc-error";

/** Donations and corrections are written only by atomic SECURITY INVOKER RPCs. */

async function client() {
  const supabase = await createClient(true);
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

function rpcFailure(error: unknown, fallback: string): Error {
  const raw = error instanceof Error ? error.message : String(error);
  // Keep the account/currency mismatch explicit without echoing SQL details.
  if (/does not match the source account/i.test(raw)) {
    return new Error("Currency does not match the selected account.");
  }
  return new Error(friendlyRpcError(error, fallback));
}

export async function createDonation(input: DonationInput): Promise<string> {
  const supabase = await client();
  const { data, error } = await supabase.rpc("create_donation", {
    p_contact_id: input.contactId || null,
    p_recipient_name: input.recipientName,
    p_recipient_type: input.recipientType,
    p_amount: input.amount,
    // Empty means "derive from the source account"; mismatches are rejected.
    p_currency_code: input.currencyCode || "",
    p_donation_date: input.donationDate,
    p_source_account_id: input.sourceAccountId,
    p_purpose: input.purpose || null,
    p_category_id: input.categoryId || null,
    p_country_code: input.countryCode || null,
    p_payment_method: input.paymentMethod || null,
    p_reference_number: input.referenceNumber || null,
    p_notes: input.notes || null,
  });

  if (error) throw rpcFailure(error, "Could not record the donation.");
  if (typeof data !== "string") {
    throw new Error("The donation was not created. Try again.");
  }
  return data;
}

export async function correctDonation(
  input: DonationCorrectionInput,
): Promise<string> {
  const supabase = await client();
  const { data, error } = await supabase.rpc("correct_donation", {
    p_donation_id: input.donationId,
    p_correction_type: input.correctionType,
    p_amount: input.amount,
    p_reason: input.reason,
  });

  if (error) throw rpcFailure(error, "Could not record the correction.");
  if (typeof data !== "string") {
    throw new Error("The correction was not created. Try again.");
  }
  return data;
}

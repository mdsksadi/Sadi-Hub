import { createClient } from "@/lib/supabase/server";
import type {
  AdminContactInput,
  ContactArchiveInput,
  LoanGivenInput,
  LoanGivenRepaymentInput,
  LoanTakenInput,
  LoanTakenRepaymentInput,
} from "@/lib/validation/lending";
import { friendlyRpcError } from "./rpc-error";

type MutableClient = NonNullable<Awaited<ReturnType<typeof createClient>>>;

async function mutableClient(): Promise<MutableClient> {
  const supabase = await createClient(true);
  if (!supabase) throw new Error("Storage is not configured.");
  return supabase;
}

function contactChanges(input: AdminContactInput) {
  return {
    full_name: input.fullName,
    contact_type: input.contactType,
    phone: input.phone,
    email: input.email,
    address: input.address,
    country_code: input.countryCode,
    notes: input.notes,
    archived_at: input.archived ? new Date().toISOString() : null,
  };
}

export async function saveContact(
  ownerId: string,
  input: AdminContactInput,
): Promise<string> {
  const supabase = await mutableClient();

  if (input.id) {
    const { data, error } = await supabase
      .from("contacts")
      .update(contactChanges(input))
      .eq("id", input.id)
      .eq("owner_id", ownerId)
      .select("id")
      .single();
    if (error) {
      throw new Error(friendlyRpcError(error, "Could not save the contact."));
    }
    return data.id;
  }

  const { data, error } = await supabase
    .from("contacts")
    .insert({ owner_id: ownerId, ...contactChanges(input) })
    .select("id")
    .single();
  if (error) {
    throw new Error(friendlyRpcError(error, "Could not save the contact."));
  }
  return data.id;
}

export async function setContactArchived(
  ownerId: string,
  input: ContactArchiveInput,
): Promise<void> {
  const supabase = await mutableClient();
  const { error } = await supabase
    .from("contacts")
    .update({ archived_at: input.archived ? new Date().toISOString() : null })
    .eq("id", input.id)
    .eq("owner_id", ownerId);
  if (error) {
    throw new Error(friendlyRpcError(error, "Could not update the contact."));
  }
}

export async function createLoanGiven(input: LoanGivenInput): Promise<string> {
  const supabase = await mutableClient();
  const { data, error } = await supabase.rpc("create_loan_given", {
    p_contact_id: input.contactId,
    p_amount: input.amount,
    p_currency_code: input.currencyCode,
    p_date_given: input.dateGiven,
    p_source_account_id: input.sourceAccountId,
    p_expected_repayment_date: input.expectedRepaymentDate,
    p_reason: input.reason,
    p_payment_method: input.paymentMethod,
    p_reference_number: input.referenceNumber,
    p_notes: input.notes,
  });
  if (error) {
    throw new Error(
      friendlyRpcError(error, "Could not record the loan given."),
    );
  }
  if (!data) throw new Error("Could not record the loan given.");
  return data;
}

export async function recordLoanGivenRepayment(
  input: LoanGivenRepaymentInput,
): Promise<string> {
  const supabase = await mutableClient();
  const { data, error } = await supabase.rpc("record_loan_given_repayment", {
    p_loan_id: input.loanId,
    p_amount: input.amount,
    p_repayment_date: input.repaymentDate,
    p_receiving_account_id: input.receivingAccountId,
    p_payment_method: input.paymentMethod,
    p_reference_number: input.referenceNumber,
    p_notes: input.notes,
  });
  if (error) {
    throw new Error(
      friendlyRpcError(error, "Could not record the repayment received."),
    );
  }
  if (!data) throw new Error("Could not record the repayment received.");
  return data;
}

export async function createLoanTaken(input: LoanTakenInput): Promise<string> {
  const supabase = await mutableClient();
  const { data, error } = await supabase.rpc("create_loan_taken", {
    p_lender_contact_id: input.lenderContactId,
    p_amount: input.amount,
    p_currency_code: input.currencyCode,
    p_date_borrowed: input.dateBorrowed,
    p_receiving_account_id: input.receivingAccountId,
    p_expected_repayment_date: input.expectedRepaymentDate,
    p_reason: input.reason,
    p_agreement_details: input.agreementDetails,
    p_notes: input.notes,
  });
  if (error) {
    throw new Error(
      friendlyRpcError(error, "Could not record the loan taken."),
    );
  }
  if (!data) throw new Error("Could not record the loan taken.");
  return data;
}

export async function recordLoanTakenRepayment(
  input: LoanTakenRepaymentInput,
): Promise<string> {
  const supabase = await mutableClient();
  const { data, error } = await supabase.rpc("record_loan_taken_repayment", {
    p_loan_id: input.loanId,
    p_amount: input.amount,
    p_payment_date: input.paymentDate,
    p_source_account_id: input.sourceAccountId,
    p_payment_method: input.paymentMethod,
    p_reference_number: input.referenceNumber,
    p_notes: input.notes,
  });
  if (error) {
    throw new Error(
      friendlyRpcError(error, "Could not record the repayment paid."),
    );
  }
  if (!data) throw new Error("Could not record the repayment paid.");
  return data;
}

import { createClient } from "@/lib/supabase/server";
import type {
  Account,
  Contact,
  ContactLendingSummary,
  LoanGivenRepayment,
  LoanGivenStatus,
  LoanTakenRepayment,
  LoanTakenStatus,
} from "../../../types/supabase";
import { logDataError } from "./log";

/** All reads are owner-scoped; RLS is the final authority even if a filter is dropped. */
export async function getContacts(ownerId: string): Promise<Contact[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .eq("owner_id", ownerId)
    .order("full_name", { ascending: true });
  if (error) {
    logDataError("contacts", error);
    return [];
  }
  return (data ?? []) as Contact[];
}

export async function getContact(
  ownerId: string,
  id: string,
): Promise<Contact | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("id", id)
    .maybeSingle();
  if (error) logDataError("contact", error);
  return (data ?? null) as Contact | null;
}

export async function getActiveAccounts(ownerId: string): Promise<Account[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (error) {
    logDataError("lending_accounts", error);
    return [];
  }
  return (data ?? []) as Account[];
}

export async function getLoansGiven(
  ownerId: string,
): Promise<LoanGivenStatus[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("loans_given_status_v")
    .select("*")
    .eq("owner_id", ownerId)
    .order("date_given", { ascending: false });
  if (error) {
    logDataError("loans_given_status", error);
    return [];
  }
  return (data ?? []) as LoanGivenStatus[];
}

export async function getLoansTaken(
  ownerId: string,
): Promise<LoanTakenStatus[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("loans_taken_status_v")
    .select("*")
    .eq("owner_id", ownerId)
    .order("date_borrowed", { ascending: false });
  if (error) {
    logDataError("loans_taken_status", error);
    return [];
  }
  return (data ?? []) as LoanTakenStatus[];
}

export async function getGivenRepayments(
  ownerId: string,
  loanIds: string[] = [],
): Promise<LoanGivenRepayment[]> {
  if (loanIds.length === 0) return [];
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("loan_given_repayments")
    .select("*")
    .eq("owner_id", ownerId)
    .in("loan_id", loanIds)
    .order("repayment_date", { ascending: false });
  if (error) {
    logDataError("loan_given_repayments", error);
    return [];
  }
  return (data ?? []) as LoanGivenRepayment[];
}

export async function getTakenRepayments(
  ownerId: string,
  loanIds: string[] = [],
): Promise<LoanTakenRepayment[]> {
  if (loanIds.length === 0) return [];
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("loan_taken_repayments")
    .select("*")
    .eq("owner_id", ownerId)
    .in("loan_id", loanIds)
    .order("payment_date", { ascending: false });
  if (error) {
    logDataError("loan_taken_repayments", error);
    return [];
  }
  return (data ?? []) as LoanTakenRepayment[];
}

export async function getContactLendingSummaries(
  ownerId: string,
): Promise<ContactLendingSummary[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("contact_lending_summary_v")
    .select("*")
    .eq("owner_id", ownerId)
    .order("full_name", { ascending: true })
    .order("currency_code", { ascending: true });
  if (error) {
    logDataError("contact_lending_summary", error);
    return [];
  }
  return (data ?? []) as ContactLendingSummary[];
}

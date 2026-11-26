import { createClient } from "@/lib/supabase/server";
import type { Document } from "../../../types/supabase";
import { logDataError } from "./log";

export type DocumentFilters = {
  category?: Document["category"] | null;
  propertyId?: string | null;
  contactId?: string | null;
  transactionId?: string | null;
  loanGivenId?: string | null;
  loanTakenId?: string | null;
  donationId?: string | null;
};

/** Read-only owner-scoped document queries with optional related-entity filters. */
export async function getDocuments(
  ownerId: string,
  filters: DocumentFilters = {},
): Promise<Document[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  let query = supabase.from("documents").select("*").eq("owner_id", ownerId);

  if (filters.category) query = query.eq("category", filters.category);
  if (filters.propertyId)
    query = query.eq("related_property_id", filters.propertyId);
  if (filters.contactId)
    query = query.eq("related_contact_id", filters.contactId);
  if (filters.transactionId)
    query = query.eq("related_transaction_id", filters.transactionId);
  if (filters.loanGivenId)
    query = query.eq("related_loan_given_id", filters.loanGivenId);
  if (filters.loanTakenId)
    query = query.eq("related_loan_taken_id", filters.loanTakenId);
  if (filters.donationId)
    query = query.eq("related_donation_id", filters.donationId);

  const { data, error } = await query
    .order("uploaded_at", { ascending: false })
    .order("id", { ascending: false });
  if (error) {
    logDataError("documents", error);
    return [];
  }
  return (data ?? []) as Document[];
}

export async function getDocument(
  ownerId: string,
  id: string,
): Promise<Document | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("id", id)
    .maybeSingle();
  if (error) logDataError("document", error);
  return (data ?? null) as Document | null;
}

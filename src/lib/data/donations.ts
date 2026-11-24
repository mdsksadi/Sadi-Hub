import { createClient } from "@/lib/supabase/server";
import type {
  Account,
  Contact,
  ContactDonationSummary,
  Donation,
  DonationCategory,
  DonationCorrection,
  MonthlyCashflow,
} from "../../../types/supabase";
import { logDataError } from "./log";

export type OwnerDonations = {
  donations: Donation[];
  categories: DonationCategory[];
  corrections: DonationCorrection[];
  contacts: Contact[];
  accounts: Account[];
};

export type DonationReports = {
  recipients: ContactDonationSummary[];
  cashflow: MonthlyCashflow[];
  donations: Donation[];
};

const emptyOwnerDonations = (): OwnerDonations => ({
  donations: [],
  categories: [],
  corrections: [],
  contacts: [],
  accounts: [],
});

const emptyReports = (): DonationReports => ({
  recipients: [],
  cashflow: [],
  donations: [],
});

/** All reads are owner-scoped even though RLS is the real authorization gate. */
export async function getOwnerDonations(
  ownerId: string,
): Promise<OwnerDonations> {
  const supabase = await createClient();
  if (!supabase) return emptyOwnerDonations();

  const [donations, categories, corrections, contacts, accounts] =
    await Promise.all([
      supabase
        .from("donations")
        .select("*")
        .eq("owner_id", ownerId)
        .order("donation_date", { ascending: false }),
      supabase
        .from("donation_categories")
        .select("*")
        .eq("owner_id", ownerId)
        .order("name", { ascending: true }),
      supabase
        .from("donation_corrections")
        .select("*")
        .eq("owner_id", ownerId)
        .order("created_at", { ascending: false }),
      supabase
        .from("contacts")
        .select("*")
        .eq("owner_id", ownerId)
        .order("full_name", { ascending: true }),
      supabase
        .from("accounts")
        .select("*")
        .eq("owner_id", ownerId)
        .order("name", { ascending: true }),
    ]);

  if (donations.error) logDataError("owner_donations", donations.error);
  if (categories.error)
    logDataError("owner_donation_categories", categories.error);
  if (corrections.error)
    logDataError("owner_donation_corrections", corrections.error);
  if (contacts.error) logDataError("owner_donation_contacts", contacts.error);
  if (accounts.error) logDataError("owner_donation_accounts", accounts.error);

  return {
    donations: (donations.data ?? []) as Donation[],
    categories: (categories.data ?? []) as DonationCategory[],
    corrections: (corrections.data ?? []) as DonationCorrection[],
    contacts: (contacts.data ?? []) as Contact[],
    accounts: (accounts.data ?? []) as Account[],
  };
}

/** Recipient totals and the monthly trend come from separate RLS-backed views. */
export async function getDonationReports(
  ownerId: string,
): Promise<DonationReports> {
  const supabase = await createClient();
  if (!supabase) return emptyReports();

  const [recipients, cashflow, donations] = await Promise.all([
    supabase
      .from("contact_donation_summary_v")
      .select("*")
      .eq("owner_id", ownerId)
      .order("total_amount", { ascending: false }),
    supabase
      .from("monthly_cashflow_v")
      .select("*")
      .eq("owner_id", ownerId)
      .order("month", { ascending: true }),
    supabase
      .from("donations")
      .select("*")
      .eq("owner_id", ownerId)
      .order("donation_date", { ascending: true }),
  ]);

  if (recipients.error)
    logDataError("donation_recipient_summary", recipients.error);
  if (cashflow.error) logDataError("donation_monthly_cashflow", cashflow.error);
  if (donations.error) logDataError("donation_trend_rows", donations.error);

  return {
    recipients: (recipients.data ?? []) as ContactDonationSummary[],
    cashflow: (cashflow.data ?? []) as MonthlyCashflow[],
    donations: (donations.data ?? []) as Donation[],
  };
}

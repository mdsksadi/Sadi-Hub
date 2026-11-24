import type {
  ContactDonationSummary,
  Donation,
  DonationCorrection,
  LedgerTransactionType,
  MonthlyCashflow,
} from "../../../types/supabase";
import { monthlyTotals, roundAmount, totalsByCurrency } from "./finance";

/**
 * Donation reporting rules. All helpers are pure and keep currencies separate:
 * an EUR gift and a BDT gift are never added into one raw total.
 */

export type RecipientGroup = Omit<ContactDonationSummary, "owner_id">;

export type MonthlySeries = Array<{ month: string; total: number }>;

export type MonthlyCashflowSeries = Array<{
  month: string;
  income: number;
  expense: number;
  net: number;
}>;

export function normalizeRecipientName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Named recipients share a group by normalized snapshot; contacts use their id. */
export function recipientKey(
  donation: Pick<Donation, "contact_id" | "recipient_name">,
): string {
  if (donation.contact_id) return `contact:${donation.contact_id}`;
  return `name:${normalizeRecipientName(donation.recipient_name)}`;
}

function currencyOf(currencyCode: string): string {
  return currencyCode.trim().toUpperCase();
}

function countryOf(countryCode: string | null): string | null {
  const country = countryCode?.trim().toUpperCase();
  return country ? country : null;
}

/** Group donation rows exactly as `contact_donation_summary_v` does. */
export function groupDonationsByRecipient(
  donations: Donation[],
): RecipientGroup[] {
  const groups = new Map<string, RecipientGroup>();

  for (const donation of donations) {
    const key = recipientKey(donation);
    const currencyCode = currencyOf(donation.currency_code);
    const countryCode = countryOf(donation.country_code);
    const groupKey = `${key}|${currencyCode}|${countryCode ?? ""}`;
    const existing = groups.get(groupKey);

    if (!existing) {
      groups.set(groupKey, {
        recipient_key: key,
        contact_id: donation.contact_id,
        recipient_name: donation.recipient_name.trim(),
        recipient_type: donation.recipient_type,
        currency_code: currencyCode,
        country_code: countryCode,
        total_amount: roundAmount(donation.amount),
        donation_count: 1,
        first_date: donation.donation_date,
        last_date: donation.donation_date,
      });
      continue;
    }

    existing.total_amount = roundAmount(
      existing.total_amount + donation.amount,
    );
    existing.donation_count += 1;
    if (donation.donation_date < existing.first_date) {
      existing.first_date = donation.donation_date;
    }
    if (donation.donation_date > existing.last_date) {
      existing.last_date = donation.donation_date;
      existing.recipient_name = donation.recipient_name.trim();
      existing.recipient_type = donation.recipient_type;
    }
  }

  return [...groups.values()].sort(
    (a, b) =>
      a.recipient_name.localeCompare(b.recipient_name) ||
      a.currency_code.localeCompare(b.currency_code),
  );
}

/** Pre-aggregated view rows still need currency-safe subtotals. */
export function recipientTotals(
  rows: ContactDonationSummary[],
): RecipientGroup[] {
  const groups = new Map<string, RecipientGroup>();

  for (const row of rows) {
    const currencyCode = currencyOf(row.currency_code);
    const countryCode = countryOf(row.country_code);
    const groupKey = `${row.recipient_key}|${currencyCode}|${countryCode ?? ""}`;
    const existing = groups.get(groupKey);

    if (!existing) {
      groups.set(groupKey, {
        recipient_key: row.recipient_key,
        contact_id: row.contact_id,
        recipient_name: row.recipient_name,
        recipient_type: row.recipient_type,
        currency_code: currencyCode,
        country_code: countryCode,
        total_amount: roundAmount(row.total_amount),
        donation_count: row.donation_count,
        first_date: row.first_date,
        last_date: row.last_date,
      });
      continue;
    }

    existing.total_amount = roundAmount(
      existing.total_amount + row.total_amount,
    );
    existing.donation_count += row.donation_count;
    if (row.first_date < existing.first_date)
      existing.first_date = row.first_date;
    if (row.last_date > existing.last_date) existing.last_date = row.last_date;
  }

  return [...groups.values()].sort(
    (a, b) =>
      a.recipient_name.localeCompare(b.recipient_name) ||
      a.currency_code.localeCompare(b.currency_code),
  );
}

export function recipientTotalsByCurrency(
  donations: Array<Pick<Donation, "currency_code" | "amount">>,
): Record<string, number> {
  return totalsByCurrency(
    donations.map((donation) => ({
      currency_code: currencyOf(donation.currency_code),
      amount: donation.amount,
    })),
  );
}

/** Ledger direction for a correction: reversals refund, adjustments spend. */
export function correctionDirection(
  type: DonationCorrection["correction_type"],
): 1 | -1 {
  return type === "reversal" ? 1 : -1;
}

export function correctionLedgerType(
  type: DonationCorrection["correction_type"],
): LedgerTransactionType {
  return type === "reversal" ? "reversal" : "correction";
}

/** Net gift after all recorded reversals and extra adjustments. */
export function netDonationAmount(
  donation: Pick<Donation, "amount">,
  corrections: Array<Pick<DonationCorrection, "correction_type" | "amount">>,
): number {
  return Math.max(
    0,
    roundAmount(
      corrections.reduce(
        (total, correction) =>
          total -
          correctionDirection(correction.correction_type) * correction.amount,
        donation.amount,
      ),
    ),
  );
}

export function monthlyDonationTotals(
  donations: Donation[],
  currencyCode?: string,
): MonthlySeries {
  const rows = currencyCode
    ? donations.filter(
        (donation) =>
          currencyOf(donation.currency_code) === currencyOf(currencyCode),
      )
    : donations;
  return monthlyTotals(
    rows,
    (row) => row.donation_date,
    (row) => row.amount,
  );
}

export function monthlyDonationTotalsByCurrency(
  donations: Donation[],
): Record<string, MonthlySeries> {
  const byCurrency: Record<string, Donation[]> = {};
  for (const donation of donations) {
    const currency = currencyOf(donation.currency_code);
    (byCurrency[currency] ??= []).push(donation);
  }
  return Object.fromEntries(
    Object.entries(byCurrency).map(([currency, rows]) => [
      currency,
      monthlyDonationTotals(rows, currency),
    ]),
  );
}

export function cashflowByCurrency(
  rows: MonthlyCashflow[],
): Record<string, MonthlyCashflow[]> {
  const byCurrency: Record<string, MonthlyCashflow[]> = {};
  for (const row of rows) {
    const currency = currencyOf(row.currency_code);
    (byCurrency[currency] ??= []).push(row);
  }
  return byCurrency;
}

export function monthlyCashflowByCurrency(
  rows: MonthlyCashflow[],
): Record<string, MonthlyCashflowSeries> {
  const result: Record<string, MonthlyCashflowSeries> = {};

  for (const [currency, currencyRows] of Object.entries(
    cashflowByCurrency(rows),
  )) {
    const income = new Map(
      monthlyTotals(
        currencyRows,
        (row) => row.month,
        (row) => row.income_amount,
      ).map(({ month, total }) => [month, total]),
    );
    const expense = new Map(
      monthlyTotals(
        currencyRows,
        (row) => row.month,
        (row) => row.expense_amount,
      ).map(({ month, total }) => [month, total]),
    );
    const net = new Map(
      monthlyTotals(
        currencyRows,
        (row) => row.month,
        (row) => row.net_amount,
      ).map(({ month, total }) => [month, total]),
    );

    result[currency] = [
      ...new Set([...income.keys(), ...expense.keys(), ...net.keys()]),
    ]
      .sort()
      .map((month) => ({
        month,
        income: roundAmount(income.get(month) ?? 0),
        expense: roundAmount(expense.get(month) ?? 0),
        net: roundAmount(net.get(month) ?? 0),
      }));
  }

  return result;
}

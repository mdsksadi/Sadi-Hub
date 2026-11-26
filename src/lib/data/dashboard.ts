import { logDataError } from "@/lib/data/log";
import { createClient } from "@/lib/supabase/server";
import type { DashboardSummary, NetWorth } from "../../../types/supabase";

/**
 * Normalized dashboard filters. The RPC derives the owner from the verified
 * JWT, so these are filters only — never a way to choose another owner's rows.
 */
export type DashboardFilters = {
  from: string | null;
  to: string | null;
  countryCode: string | null;
  currencyCode: string | null;
};

/** Raw URL search params (Next.js may supply arrays) plus internal aliases. */
export type DashboardFilterInput = {
  from?: string | string[] | null;
  to?: string | string[] | null;
  country?: string | string[] | null;
  currency?: string | string[] | null;
  countryCode?: string | string[] | null;
  currencyCode?: string | string[] | null;
};

export type DashboardFilterOptions = {
  currencies: Array<{ code: string; name: string }>;
  countries: string[];
};

function firstValue(
  value: string | string[] | null | undefined,
): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

function isoDate(value: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    return null;
  }
  return value;
}

function validCountry(value: string | null): string | null {
  const code = value?.trim();
  return code && /^[A-Za-z]{2}$/.test(code) ? code.toUpperCase() : null;
}

function validCurrency(value: string | null): string | null {
  const code = value?.trim();
  return code && /^[A-Za-z]{3}$/.test(code) ? code.toUpperCase() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** JSONB numbers arrive as numbers, but accept numeric strings defensively. */
function numeric(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function amount(value: unknown): number {
  return numeric(value) ?? 0;
}

function countValue(value: unknown): number {
  return Math.max(0, Math.floor(amount(value)));
}

function currencyAmounts(value: unknown): Record<string, number> {
  const result: Record<string, number> = {};
  if (!isRecord(value)) return result;
  for (const [key, raw] of Object.entries(value)) {
    const code = validCurrency(key);
    const parsed = numeric(raw);
    if (!code || parsed === null) continue;
    result[code] = (result[code] ?? 0) + parsed;
  }
  return result;
}

function emptyNetWorth(ownerId: string, reportingCurrency: string): NetWorth {
  return {
    owner_id: ownerId,
    as_of: "",
    reporting_currency: reportingCurrency,
    cash_amount_reporting: 0,
    property_amount_reporting: 0,
    receivables_amount_reporting: 0,
    payables_amount_reporting: 0,
    net_amount_reporting: 0,
    missing_rate_currencies: [],
  };
}

function parseNetWorth(
  value: unknown,
  ownerId: string,
  fallbackCurrency: string,
): NetWorth {
  const row = isRecord(value) ? value : {};
  const missing = Array.isArray(row.missing_rate_currencies)
    ? row.missing_rate_currencies
    : [];
  const missingRateCurrencies = [
    ...new Set(
      missing
        .map((item) => (typeof item === "string" ? validCurrency(item) : null))
        .filter((code): code is string => code !== null),
    ),
  ];

  return {
    owner_id:
      typeof row.owner_id === "string" && row.owner_id ? row.owner_id : ownerId,
    as_of: isoDate(typeof row.as_of === "string" ? row.as_of : null) ?? "",
    reporting_currency:
      validCurrency(
        typeof row.reporting_currency === "string"
          ? row.reporting_currency
          : null,
      ) ?? fallbackCurrency,
    cash_amount_reporting: amount(row.cash_amount_reporting),
    property_amount_reporting: amount(row.property_amount_reporting),
    receivables_amount_reporting: amount(row.receivables_amount_reporting),
    payables_amount_reporting: amount(row.payables_amount_reporting),
    net_amount_reporting: amount(row.net_amount_reporting),
    missing_rate_currencies: missingRateCurrencies,
  };
}

function emptySummary(
  filters: DashboardFilters,
  ownerId: string,
  reportingCurrency = "EUR",
): DashboardSummary {
  return {
    filters: { ...filters, reportingCurrency },
    counts: {
      accounts: 0,
      contacts: 0,
      properties: 0,
      documents: 0,
      publishedPosts: 0,
    },
    cashByCurrency: {},
    cashflow: {
      incomeAmount: 0,
      expenseAmount: 0,
      incomeReporting: 0,
      expenseReporting: 0,
    },
    donationsByCurrency: {},
    outstanding: { receivable: {}, payable: {} },
    netWorth: emptyNetWorth(ownerId, reportingCurrency),
  };
}

function parseReportedFilters(
  value: unknown,
  requested: DashboardFilters,
): DashboardSummary["filters"] {
  const row = isRecord(value) ? value : {};
  return {
    from:
      isoDate(typeof row.from === "string" ? row.from : null) ?? requested.from,
    to: isoDate(typeof row.to === "string" ? row.to : null) ?? requested.to,
    countryCode:
      validCountry(
        typeof row.countryCode === "string" ? row.countryCode : null,
      ) ?? requested.countryCode,
    currencyCode:
      validCurrency(
        typeof row.currencyCode === "string" ? row.currencyCode : null,
      ) ?? requested.currencyCode,
    reportingCurrency:
      validCurrency(
        typeof row.reportingCurrency === "string"
          ? row.reportingCurrency
          : null,
      ) ?? "EUR",
  };
}

function parseSummary(
  value: unknown,
  filters: DashboardFilters,
  ownerId: string,
): DashboardSummary {
  const root = isRecord(value) ? value : {};
  const parsedFilters = parseReportedFilters(root.filters, filters);
  const counts = isRecord(root.counts) ? root.counts : {};
  const cashflow = isRecord(root.cashflow) ? root.cashflow : {};
  const outstanding = isRecord(root.outstanding) ? root.outstanding : {};
  const netWorth = parseNetWorth(
    root.netWorth,
    ownerId,
    parsedFilters.reportingCurrency,
  );

  // The RPC is owner-gated, but never render a payload for a different owner.
  if (netWorth.owner_id !== ownerId) {
    logDataError("dashboard_summary_owner_mismatch", "owner mismatch");
    return emptySummary(filters, ownerId, parsedFilters.reportingCurrency);
  }

  return {
    filters: parsedFilters,
    counts: {
      accounts: countValue(counts.accounts),
      contacts: countValue(counts.contacts),
      properties: countValue(counts.properties),
      documents: countValue(counts.documents),
      publishedPosts: countValue(counts.publishedPosts),
    },
    cashByCurrency: currencyAmounts(root.cashByCurrency),
    cashflow: {
      incomeAmount: amount(cashflow.incomeAmount),
      expenseAmount: amount(cashflow.expenseAmount),
      incomeReporting: amount(cashflow.incomeReporting),
      expenseReporting: amount(cashflow.expenseReporting),
    },
    donationsByCurrency: currencyAmounts(root.donationsByCurrency),
    outstanding: {
      receivable: currencyAmounts(outstanding.receivable),
      payable: currencyAmounts(outstanding.payable),
    },
    netWorth,
  };
}

/** Reject malformed URL values before they reach a typed SQL argument. */
export function parseDashboardFilters(
  input: DashboardFilterInput,
): DashboardFilters {
  const from = isoDate(firstValue(input.from));
  const to = isoDate(firstValue(input.to));
  return {
    from,
    // An inverted range would fail in SQL; drop the end date instead.
    to: from && to && from > to ? null : to,
    countryCode:
      validCountry(firstValue(input.country)) ??
      validCountry(firstValue(input.countryCode)),
    currencyCode:
      validCurrency(firstValue(input.currency)) ??
      validCurrency(firstValue(input.currencyCode)),
  };
}

/** Reads the owner-scoped dashboard JSON; malformed values become zeros. */
export async function getDashboardSummary(
  ownerId: string,
  filters: DashboardFilterInput = {},
): Promise<DashboardSummary> {
  const normalized = parseDashboardFilters(filters);
  const supabase = await createClient();
  if (!supabase) return emptySummary(normalized, ownerId);

  const { data, error } = await supabase.rpc("get_dashboard_summary", {
    p_from_date: normalized.from,
    p_to_date: normalized.to,
    p_country_code: normalized.countryCode,
    p_currency_code: normalized.currencyCode,
  });

  if (error) {
    logDataError("dashboard_summary", error);
    return emptySummary(normalized, ownerId);
  }
  return parseSummary(data, normalized, ownerId);
}

/** Net worth at a date, translated with snapshotted rates by the database. */
export async function getNetWorth(
  ownerId: string,
  asOf?: string | null,
  reportingCurrency?: string | null,
): Promise<NetWorth> {
  const date = isoDate(firstValue(asOf));
  const currency = validCurrency(firstValue(reportingCurrency));
  const supabase = await createClient();
  if (!supabase) return emptyNetWorth(ownerId, currency ?? "EUR");

  const { data, error } = await supabase.rpc("get_net_worth", {
    p_as_of: date,
    p_reporting_currency: currency,
  });

  if (error) {
    logDataError("dashboard_net_worth", error);
    return emptyNetWorth(ownerId, currency ?? "EUR");
  }

  const row = Array.isArray(data) ? data[0] : undefined;
  const parsed = parseNetWorth(row, ownerId, currency ?? "EUR");
  if (parsed.owner_id !== ownerId) {
    logDataError("dashboard_net_worth_owner_mismatch", "owner mismatch");
    return emptyNetWorth(ownerId, currency ?? "EUR");
  }
  return parsed;
}

/** Options for the GET filter form; country codes come from owner data. */
export async function getDashboardFilterOptions(
  ownerId: string,
): Promise<DashboardFilterOptions> {
  const supabase = await createClient();
  if (!supabase) return { currencies: [], countries: [] };

  const [currencies, accounts, contacts, donations] = await Promise.all([
    supabase
      .from("currencies")
      .select("code, name")
      .eq("is_active", true)
      .order("code", { ascending: true }),
    supabase.from("accounts").select("country_code").eq("owner_id", ownerId),
    supabase.from("contacts").select("country_code").eq("owner_id", ownerId),
    supabase.from("donations").select("country_code").eq("owner_id", ownerId),
  ]);

  if (currencies.error)
    logDataError("dashboard_currency_options", currencies.error);
  if (accounts.error)
    logDataError("dashboard_account_countries", accounts.error);
  if (contacts.error)
    logDataError("dashboard_contact_countries", contacts.error);
  if (donations.error)
    logDataError("dashboard_donation_countries", donations.error);

  return {
    currencies: (currencies.data ?? [])
      .map((row) => ({
        code: validCurrency(row.code) ?? "",
        name: row.name.trim(),
      }))
      .filter((row) => row.code !== ""),
    countries: [
      ...new Set(
        [
          ...(accounts.data ?? []),
          ...(contacts.data ?? []),
          ...(donations.data ?? []),
        ]
          .map((row) => validCountry(row.country_code))
          .filter((code): code is string => code !== null),
      ),
    ].sort(),
  };
}

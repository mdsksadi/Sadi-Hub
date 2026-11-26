import { describe, expect, it } from "vitest";
import {
  cashflowFor,
  isCashNeutralType,
  isExpenseType,
  isIncomeType,
  translateAmount,
} from "@/lib/domain/finance";
import { parseDashboardFilters } from "@/lib/data/dashboard";
import type { DashboardSummary, NetWorth } from "../../types/supabase";
import type { LedgerTransactionType } from "../../types/supabase";

/**
 * Phase 8 dashboard payload rules. `get_dashboard_summary(text,text,text,text)`
 * returns jsonb; these pure helpers cover the presentation contract: EUR and
 * BDT stay separate, translation uses only snapshotted rates, missing rates are
 * disclosed, and net worth components are labelled. No I/O is performed.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numeric(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function parseCurrencyAmounts(raw: unknown): Record<string, number> {
  const result: Record<string, number> = {};
  if (!isRecord(raw)) return result;
  for (const [currency, amount] of Object.entries(raw)) {
    const code = text(currency).toUpperCase();
    if (!/^[A-Z]{3}$/.test(code)) continue;
    result[code] = (result[code] ?? 0) + numeric(amount);
  }
  return result;
}

function parseNetWorth(raw: unknown, ownerId: string): NetWorth {
  const row = isRecord(raw) ? raw : {};
  return {
    owner_id: text(row.owner_id) || ownerId,
    as_of: text(row.as_of),
    reporting_currency: text(row.reporting_currency).toUpperCase() || "EUR",
    cash_amount_reporting: numeric(row.cash_amount_reporting),
    property_amount_reporting: numeric(row.property_amount_reporting),
    receivables_amount_reporting: numeric(row.receivables_amount_reporting),
    payables_amount_reporting: numeric(row.payables_amount_reporting),
    net_amount_reporting: numeric(row.net_amount_reporting),
    missing_rate_currencies: Array.isArray(row.missing_rate_currencies)
      ? row.missing_rate_currencies.filter(
          (code): code is string => typeof code === "string",
        )
      : [],
  };
}

/** Mirrors the RPC payload while reusing the real filter normalization. */
function parseDashboardSummary(
  raw: unknown,
  ownerId: string,
): DashboardSummary {
  const root = isRecord(raw) ? raw : {};
  const reported = isRecord(root.filters) ? root.filters : {};
  const cashflow = isRecord(root.cashflow) ? root.cashflow : {};
  const outstanding = isRecord(root.outstanding) ? root.outstanding : {};
  const counts = isRecord(root.counts) ? root.counts : {};

  return {
    filters: {
      ...parseDashboardFilters({
        from: text(reported.from),
        to: text(reported.to),
        countryCode: text(reported.countryCode),
        currencyCode: text(reported.currencyCode),
      }),
      reportingCurrency:
        text(reported.reportingCurrency).toUpperCase() || "EUR",
    },
    counts: {
      accounts: numeric(counts.accounts),
      contacts: numeric(counts.contacts),
      properties: numeric(counts.properties),
      documents: numeric(counts.documents),
      publishedPosts: numeric(counts.publishedPosts),
    },
    cashByCurrency: parseCurrencyAmounts(root.cashByCurrency),
    cashflow: {
      incomeAmount: numeric(cashflow.incomeAmount),
      expenseAmount: numeric(cashflow.expenseAmount),
      incomeReporting: numeric(cashflow.incomeReporting),
      expenseReporting: numeric(cashflow.expenseReporting),
    },
    donationsByCurrency: parseCurrencyAmounts(root.donationsByCurrency),
    outstanding: {
      receivable: parseCurrencyAmounts(outstanding.receivable),
      payable: parseCurrencyAmounts(outstanding.payable),
    },
    netWorth: parseNetWorth(root.netWorth, ownerId),
  };
}

/** Returns null when no snapshotted rate exists; never falls back to a live rate. */
function translateWithSnapshot(
  amount: number,
  rate: number | null | undefined,
  reportingCurrency: string,
): { amountReporting: number; label: string } | null {
  if (
    rate === null ||
    rate === undefined ||
    !Number.isFinite(rate) ||
    rate <= 0
  ) {
    return null;
  }
  return {
    amountReporting: translateAmount(amount, rate),
    label: `Translated to ${reportingCurrency} at snapshotted rate ${rate}`,
  };
}

function missingRateWarnings(netWorth: NetWorth): string[] {
  return [...new Set(netWorth.missing_rate_currencies)]
    .filter((currency) => currency.trim().length > 0)
    .map(
      (currency) =>
        `No snapshotted ${currency.trim().toUpperCase()} → ${netWorth.reporting_currency} rate; those amounts are excluded`,
    );
}

function netWorthComponents(netWorth: NetWorth): Array<{
  key: string;
  label: string;
  amountReporting: number;
}> {
  return [
    {
      key: "cash",
      label: "Cash (all accounts)",
      amountReporting: netWorth.cash_amount_reporting,
    },
    {
      key: "property",
      label: "Property (ESTIMATED)",
      amountReporting: netWorth.property_amount_reporting,
    },
    {
      key: "receivable",
      label: "Outstanding receivables",
      amountReporting: netWorth.receivables_amount_reporting,
    },
    {
      key: "payable",
      label: "Outstanding payables",
      amountReporting: -netWorth.payables_amount_reporting,
    },
  ];
}

const OWNER_ID = "00000000-0000-4000-8000-000000000001";

function summaryFixture(): Record<string, unknown> {
  return {
    filters: {
      from: " 2026-01-01 ",
      to: null,
      countryCode: " bd ",
      currencyCode: "",
      reportingCurrency: "eur",
    },
    counts: { accounts: 2, contacts: 1, properties: 1, documents: 3 },
    cashByCurrency: { EUR: 1000, BDT: 20000, eur: 50 },
    cashflow: {
      incomeAmount: 500,
      expenseAmount: 120,
      incomeReporting: 500,
      expenseReporting: 120,
    },
    donationsByCurrency: { EUR: 120, BDT: 5000 },
    outstanding: {
      receivable: { EUR: 200, BDT: 1000 },
      payable: { EUR: 100 },
    },
    netWorth: {
      owner_id: OWNER_ID,
      as_of: "2026-11-25",
      reporting_currency: "EUR",
      cash_amount_reporting: 1166.6666,
      property_amount_reporting: 1250,
      receivables_amount_reporting: 208.3333,
      payables_amount_reporting: 100,
      net_amount_reporting: 2525,
      missing_rate_currencies: [],
    },
  };
}

describe("dashboard payload parsing", () => {
  it("parses the RPC payload and keeps EUR and BDT separate", () => {
    const summary = parseDashboardSummary(summaryFixture(), OWNER_ID);
    expect(summary.cashByCurrency).toEqual({ EUR: 1050, BDT: 20000 });
    expect(summary.donationsByCurrency).toEqual({ EUR: 120, BDT: 5000 });
    expect(summary.outstanding).toEqual({
      receivable: { EUR: 200, BDT: 1000 },
      payable: { EUR: 100 },
    });
    expect(Object.keys(summary.cashByCurrency)).not.toContain("TOTAL");
    expect(summary.counts).toMatchObject({
      accounts: 2,
      properties: 1,
      documents: 3,
    });
  });

  it("normalizes optional filters without inventing values", () => {
    expect(parseDashboardSummary(summaryFixture(), OWNER_ID).filters).toEqual({
      from: "2026-01-01",
      to: null,
      countryCode: "BD",
      currencyCode: null,
      reportingCurrency: "EUR",
    });
    expect(
      parseDashboardFilters({
        from: [" 2026-01-01 ", "2026-02-01"],
        to: "01/02/2026",
        country: "bd",
        currencyCode: "bdt",
      }),
    ).toEqual({
      from: "2026-01-01",
      to: null,
      countryCode: "BD",
      currencyCode: "BDT",
    });
    expect(
      parseDashboardFilters({ from: "2026-05-01", to: "2026-04-01" }),
    ).toEqual({
      from: "2026-05-01",
      to: null,
      countryCode: null,
      currencyCode: null,
    });
  });

  it("survives an empty payload with usable defaults", () => {
    expect(parseDashboardSummary(null, OWNER_ID)).toMatchObject({
      filters: {
        from: null,
        to: null,
        countryCode: null,
        currencyCode: null,
        reportingCurrency: "EUR",
      },
      cashByCurrency: {},
      donationsByCurrency: {},
      outstanding: { receivable: {}, payable: {} },
      netWorth: { owner_id: OWNER_ID, missing_rate_currencies: [] },
    });
  });
});

describe("snapshotted translation", () => {
  it("translates only with the rate supplied by the payload", () => {
    const translated = translateWithSnapshot(1200, 0.00833333, "EUR");
    expect(translated?.amountReporting).toBe(10);
    expect(translated?.label).toContain("snapshotted rate");
  });

  it("never sums currencies or invents a rate when it is missing", () => {
    expect(translateWithSnapshot(20000, null, "EUR")).toBeNull();
    expect(translateWithSnapshot(20000, undefined, "EUR")).toBeNull();
    expect(translateWithSnapshot(20000, 0, "EUR")).toBeNull();
    expect(translateWithSnapshot(1000, 1, "EUR")?.amountReporting).toBe(1000);
  });
});

describe("net worth presentation", () => {
  const netWorth: NetWorth = {
    owner_id: OWNER_ID,
    as_of: "2026-11-25",
    reporting_currency: "EUR",
    cash_amount_reporting: 100,
    property_amount_reporting: 250,
    receivables_amount_reporting: 50,
    payables_amount_reporting: 40,
    net_amount_reporting: 360,
    missing_rate_currencies: ["BDT", "BDT"],
  };

  it("labels every component and signs payables as a deduction", () => {
    expect(netWorthComponents(netWorth)).toEqual([
      {
        key: "cash",
        label: "Cash (all accounts)",
        amountReporting: 100,
      },
      {
        key: "property",
        label: "Property (ESTIMATED)",
        amountReporting: 250,
      },
      {
        key: "receivable",
        label: "Outstanding receivables",
        amountReporting: 50,
      },
      {
        key: "payable",
        label: "Outstanding payables",
        amountReporting: -40,
      },
    ]);
  });

  it("surfaces one warning per currency with a missing rate", () => {
    expect(missingRateWarnings(netWorth)).toEqual([
      "No snapshotted BDT → EUR rate; those amounts are excluded",
    ]);
    expect(
      missingRateWarnings({ ...netWorth, missing_rate_currencies: [] }),
    ).toEqual([]);
  });
});

describe("dashboard cashflow classification", () => {
  it("classifies income, donation refunds, expenses and adjustments", () => {
    expect(isIncomeType("income")).toBe(true);
    expect(isIncomeType("reversal")).toBe(true);
    expect(isExpenseType("expense")).toBe(true);
    expect(isExpenseType("donation")).toBe(true);
    expect(isExpenseType("correction")).toBe(true);
    expect(cashflowFor("reversal", 25, 30).income).toBe(25);
    expect(cashflowFor("donation", 25, 30).expense).toBe(25);
  });

  it("treats transfers and loan principal movements as neutral", () => {
    const neutralTypes: LedgerTransactionType[] = [
      "transfer_out",
      "transfer_in",
      "loan_disbursed",
      "loan_repayment_received",
      "borrowing_received",
      "borrowing_repayment_paid",
    ];
    for (const type of neutralTypes) {
      expect(isCashNeutralType(type)).toBe(true);
      expect(cashflowFor(type, 500, 600)).toEqual({
        income: 0,
        expense: 0,
        incomeReporting: 0,
        expenseReporting: 0,
      });
    }
  });
});

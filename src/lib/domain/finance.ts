import type { LedgerTransactionType } from "../../../types/supabase";

/**
 * Shared, pure finance rules. Every admin screen and every unit test uses
 * these helpers so classification and rounding cannot drift between modules.
 */

const INCOME_TYPES = new Set<LedgerTransactionType>(["income", "reversal"]);

const EXPENSE_TYPES = new Set<LedgerTransactionType>([
  "expense",
  "donation",
  "correction",
]);

const CASH_NEUTRAL_TYPES = new Set<LedgerTransactionType>([
  "transfer_out",
  "transfer_in",
  "loan_disbursed",
  "loan_repayment_received",
  "borrowing_received",
  "borrowing_repayment_paid",
]);

export function isIncomeType(type: LedgerTransactionType): boolean {
  return INCOME_TYPES.has(type);
}

export function isExpenseType(type: LedgerTransactionType): boolean {
  return EXPENSE_TYPES.has(type);
}

export function isCashNeutralType(type: LedgerTransactionType): boolean {
  return CASH_NEUTRAL_TYPES.has(type);
}

/** HTML number inputs and Zod keep decimals as strings; parse once here. */
export function parseAmount(value: string): number | null {
  if (!/^\d+(?:\.\d{1,4})?$/.test(value.trim())) return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export function roundAmount(value: number, digits = 4): number {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function translateAmount(amount: number, rate: number): number {
  return roundAmount(amount * rate, 4);
}

export function balanceAfter(opening: number, movements: number[]): number {
  return roundAmount(
    movements.reduce((balance, movement) => balance + movement, opening),
    4,
  );
}

export function cashflowFor(
  type: LedgerTransactionType,
  amount: number,
  amountReporting: number,
): {
  income: number;
  expense: number;
  incomeReporting: number;
  expenseReporting: number;
} {
  if (isIncomeType(type)) {
    return {
      income: amount,
      expense: 0,
      incomeReporting: amountReporting,
      expenseReporting: 0,
    };
  }
  if (isExpenseType(type)) {
    return {
      income: 0,
      expense: amount,
      incomeReporting: 0,
      expenseReporting: amountReporting,
    };
  }
  // Transfers and loan principal movements are cash-only, never income/expense.
  return {
    income: 0,
    expense: 0,
    incomeReporting: 0,
    expenseReporting: 0,
  };
}

export function monthlyTotals<T>(
  rows: T[],
  getDate: (row: T) => string,
  getValue: (row: T) => number,
): Array<{ month: string; total: number }> {
  const byMonth = new Map<string, number>();
  for (const row of rows) {
    const month = getDate(row).slice(0, 7);
    byMonth.set(month, roundAmount((byMonth.get(month) ?? 0) + getValue(row)));
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, total]) => ({ month, total }));
}

export function totalsByCurrency(
  rows: Array<{ currency_code: string; amount: number }>,
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const row of rows) {
    const currency = row.currency_code.toUpperCase();
    totals[currency] = roundAmount((totals[currency] ?? 0) + row.amount);
  }
  return totals;
}

export function monthLabel(month: string, locale = "en-US"): string {
  const date = new Date(`${month.slice(0, 7)}-01T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return month;
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

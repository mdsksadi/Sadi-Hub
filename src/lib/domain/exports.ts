import { roundAmount } from "./finance";

/**
 * Pure helpers for CSV/PDF exports. No I/O and no framework imports live in
 * this module so the rules can be unit tested in isolation.
 */

export type CsvValue = string | number | boolean | null | undefined;

export type CsvColumn<T> = {
  header: string;
  value: (row: T) => CsvValue;
};

export type DateRange = { from: string | null; to: string | null };

export type CashflowForExport = {
  currency_code: string;
  income_amount?: number | null;
  expense_amount?: number | null;
  net_amount?: number | null;
};

export type DonationForExport = {
  currency_code: string;
  amount?: number | null;
};

export type CurrencySummary = {
  currency: string;
  income: number;
  expense: number;
  net: number;
  donations: number;
};

const FORMULA_PREFIX = /^[=+\-@]/;
const CSV_SPECIAL = /[",\r\n]/;

function asText(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  return typeof value === "string" ? value : String(value);
}

/**
 * RFC-4180 quoting plus spreadsheet formula neutralisation. A leading
 * =, +, - or @ is prefixed with a single quote before the cell is quoted, so
 * a value such as `=HYPERLINK(...)` is never evaluated on open.
 */
export function escapeCsvCell(value: CsvValue): string {
  const raw = asText(value);
  if (raw.length === 0) return "";
  const neutralised = FORMULA_PREFIX.test(raw) ? `'${raw}` : raw;
  return CSV_SPECIAL.test(neutralised)
    ? `"${neutralised.replace(/"/g, '""')}"`
    : neutralised;
}

/** One record, joined with commas and terminated by CRLF by `buildCsv`. */
export function buildCsvRow(cells: readonly CsvValue[]): string {
  return cells.map(escapeCsvCell).join(",");
}

/** UTF-8 BOM + CRLF rows (RFC-4180), including a final CRLF. */
export function buildCsv(rows: readonly (readonly CsvValue[])[]): string {
  if (rows.length === 0) return "\uFEFF";
  return `\uFEFF${rows.map(buildCsvRow).join("\r\n")}\r\n`;
}

/** Columns are emitted in declaration order, so exports stay stable. */
export function buildCsvFromColumns<T>(
  columns: readonly CsvColumn<T>[],
  rows: readonly T[],
): string {
  return buildCsv([
    columns.map((column) => column.header),
    ...rows.map((row) => columns.map((column) => column.value(row))),
  ]);
}

/** Strict calendar-date validation; rejects rollover dates such as 2026-02-30. */
export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** Returns null for malformed or inverted ranges. Either bound may be open. */
export function parseDateRange(params: {
  from?: string | null;
  to?: string | null;
}): DateRange | null {
  const from = params.from?.trim() || null;
  const to = params.to?.trim() || null;
  if (from && !isValidIsoDate(from)) return null;
  if (to && !isValidIsoDate(to)) return null;
  if (from && to && from > to) return null;
  return { from, to };
}

function datePart(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value).slice(0, 10)
    : "";
}

/** Filter owner-scoped rows by a DATE or TIMESTAMPTZ column. */
export function filterRowsByDate<T extends Record<string, unknown>>(
  rows: readonly T[],
  column: string,
  range: DateRange,
): T[] {
  return rows.filter((row) => {
    const value = datePart(row[column]);
    if (!value) return !range.from && !range.to;
    if (range.from && value < range.from) return false;
    if (range.to && value > range.to) return false;
    return true;
  });
}

/** Monthly view rows use `YYYY-MM`, not a full ISO date. */
export function filterRowsByMonth<T extends Record<string, unknown>>(
  rows: readonly T[],
  column: string,
  range: DateRange,
): T[] {
  const from = range.from?.slice(0, 7) ?? null;
  const to = range.to?.slice(0, 7) ?? null;
  return rows.filter((row) => {
    const value = datePart(row[column]).slice(0, 7);
    if (!value) return !from && !to;
    if (from && value < from) return false;
    if (to && value > to) return false;
    return true;
  });
}

/** Restrict a user-supplied label before it reaches Content-Disposition. */
export function safeFilenamePart(value: string): string {
  const safe = value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return safe || "export";
}

export function exportFilename(
  kind: string,
  date: string,
  extension: "csv" | "pdf",
): string {
  const safeDate = isValidIsoDate(date) ? date : safeFilenamePart(date);
  return `sadi-hub-${safeFilenamePart(kind)}-${safeDate}.${extension}`;
}

/**
 * pdf-lib's standard fonts are WinAnsi encoded. Strip control characters,
 * collapse whitespace, replace characters the font cannot encode and cap the
 * length before anything is passed to drawText().
 */
export function sanitizePdfText(input: unknown, maxLength = 160): string {
  const raw = input === null || input === undefined ? "" : String(input);
  const cleaned = raw
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[^\u0020-\u007E\u00A0-\u00FF]/g, "?")
    .trim();
  if (cleaned.length <= maxLength) return cleaned;
  if (maxLength <= 3) return cleaned.slice(0, maxLength);
  return `${cleaned.slice(0, maxLength - 3)}...`;
}

function finiteNumber(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * Group cashflow and donations by their original currency only. EUR and BDT
 * are never added together; translated report-currency columns are not used
 * for these totals.
 */
export function summarizeByCurrency(
  cashflow: readonly CashflowForExport[],
  donations: readonly DonationForExport[] = [],
): CurrencySummary[] {
  const summary = new Map<string, CurrencySummary>();

  const bucket = (currencyCode: string): CurrencySummary => {
    const currency = currencyCode.trim().toUpperCase() || "UNKNOWN";
    let row = summary.get(currency);
    if (!row) {
      row = { currency, income: 0, expense: 0, net: 0, donations: 0 };
      summary.set(currency, row);
    }
    return row;
  };

  for (const row of cashflow) {
    const total = bucket(row.currency_code);
    total.income += finiteNumber(row.income_amount);
    total.expense += finiteNumber(row.expense_amount);
    total.net += finiteNumber(row.net_amount);
  }
  for (const row of donations) {
    bucket(row.currency_code).donations += finiteNumber(row.amount);
  }

  return [...summary.values()]
    .sort((a, b) => a.currency.localeCompare(b.currency))
    .map((row) => ({
      currency: row.currency,
      income: roundAmount(row.income),
      expense: roundAmount(row.expense),
      net: roundAmount(row.net),
      donations: roundAmount(row.donations),
    }));
}

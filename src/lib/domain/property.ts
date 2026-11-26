import { formatMoney } from "./money";

/**
 * Pure property rules. No Supabase, no I/O. Ownership shares are handled as
 * integer hundredths so 33.33 + 33.33 + 33.34 is exact, never 99.999999.
 */
export type OwnerShareInput = { ownershipPercentage: string | number };

export type OwnerSharesResult = {
  hundredths: number[];
  totalHundredths: number;
  total: string;
  valid: boolean;
  message: string | null;
};

const HUNDREDTHS_TOTAL = 10_000;
const MAX_OWNERS = 20;

/** Returns integer hundredths, or null for an invalid share. */
export function parseShareHundredths(value: string | number): number | null {
  const text = typeof value === "number" ? String(value) : value.trim();
  if (!/^\d{1,3}(?:\.\d{1,2})?$/.test(text)) return null;
  const [whole, decimals = ""] = text.split(".");
  const hundredths =
    Number(whole) * 100 + Number(decimals.padEnd(2, "0").slice(0, 2));
  return Number.isInteger(hundredths) &&
    hundredths > 0 &&
    hundredths <= HUNDREDTHS_TOTAL
    ? hundredths
    : null;
}

export function formatShareHundredths(hundredths: number): string {
  const safe = Math.max(0, Math.round(hundredths));
  return `${Math.floor(safe / 100)}.${String(safe % 100).padStart(2, "0")}`;
}

/**
 * Normalises a roster and checks the DB invariant: every share is in
 * (0, 100], has at most two decimals, and the roster totals exactly 100.00.
 */
export function normalizeOwnerShares(
  owners: OwnerShareInput[],
): OwnerSharesResult {
  const hundredths = owners.map((owner) =>
    parseShareHundredths(owner.ownershipPercentage),
  );
  const validShares = hundredths.every(
    (share): share is number => share !== null,
  );
  const totalHundredths = hundredths.reduce<number>(
    (total, share) => total + (share ?? 0),
    0,
  );
  let message: string | null = null;
  if (!validShares) {
    message = "Each share must be positive, at most 100, with two decimals.";
  } else if (owners.length < 1 || owners.length > MAX_OWNERS) {
    message = `Provide between 1 and ${MAX_OWNERS} owners.`;
  } else if (totalHundredths !== HUNDREDTHS_TOTAL) {
    message = "Ownership shares must total exactly 100.00.";
  }

  return {
    hundredths: hundredths.map((share) => share ?? 0),
    totalHundredths,
    total: formatShareHundredths(totalHundredths),
    valid: message === null,
    message,
  };
}

export function validateOwnerShares(owners: OwnerShareInput[]): boolean {
  return normalizeOwnerShares(owners).valid;
}

export type AreaConversion = {
  from_unit: string;
  to_unit: string;
  factor: number;
  valid_from: string;
  created_at?: string;
};

function normalizeUnit(unit: string | null | undefined): string {
  return (unit ?? "").trim().toLowerCase();
}

export function roundArea(value: number, digits = 4): number {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/**
 * Converts a land area using the newest conversion snapshot at or before the
 * requested date. There is deliberately no built-in Katha/Bigha factor: when
 * no configured conversion applies, the result is null.
 */
export function convertArea(
  value: number | null | undefined,
  fromUnit: string | null | undefined,
  toUnit: string | null | undefined,
  conversions: AreaConversion[],
  onDate?: string | null,
): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }
  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);
  if (!from || !to) return null;
  if (from === to) return roundArea(value);

  const snapshot = conversions
    .filter(
      (conversion) =>
        normalizeUnit(conversion.from_unit) === from &&
        normalizeUnit(conversion.to_unit) === to &&
        Number.isFinite(conversion.factor) &&
        conversion.factor > 0 &&
        (!onDate || conversion.valid_from.slice(0, 10) <= onDate.slice(0, 10)),
    )
    .sort((a, b) => {
      const byDate = b.valid_from.localeCompare(a.valid_from);
      if (byDate !== 0) return byDate;
      return (b.created_at ?? "").localeCompare(a.created_at ?? "");
    })[0];

  return snapshot ? roundArea(value * snapshot.factor) : null;
}

/** Always shows the original unit; no silent regional-unit assumptions. */
export function formatArea(
  value: number | null | undefined,
  unit: string | null | undefined,
  locale = "en-US",
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  const amount = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 4,
  }).format(value);
  const label = unit?.trim();
  return label ? `${amount} ${label}` : amount;
}

export const ESTIMATED_LABEL = "ESTIMATED";

/**
 * Property values are always estimates, even when their source has been
 * checked. This helper never renders a "verified market price" claim.
 */
export function formatEstimatedValue(
  value: number | null | undefined,
  currency: string | null | undefined,
  valuedOn?: string | null,
  locale = "en-US",
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return `${ESTIMATED_LABEL} —`;
  }
  const code = currency?.trim().toUpperCase() ?? "";
  const amount = /^[A-Z]{3}$/.test(code)
    ? formatMoney(value, code, locale)
    : new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);
  const suffix = valuedOn ? ` · as of ${valuedOn.slice(0, 10)}` : "";
  return `${ESTIMATED_LABEL} ${amount}${suffix}`;
}

/** Generic grouping for ownership rosters, valuations and linked documents. */
export function groupBy<T, K extends string>(
  rows: T[],
  keyOf: (row: T) => K | null | undefined,
): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const row of rows) {
    const key = keyOf(row);
    if (key === null || key === undefined) continue;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }
  return groups;
}

export function sortOwners<T extends { owner_name: string }>(owners: T[]): T[] {
  return [...owners].sort((a, b) => a.owner_name.localeCompare(b.owner_name));
}

export function sortValuationsNewest<
  T extends { valued_on: string; created_at?: string },
>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const byDate = b.valued_on.localeCompare(a.valued_on);
    return byDate !== 0
      ? byDate
      : (b.created_at ?? "").localeCompare(a.created_at ?? "");
  });
}

export function sortPropertiesByName<T extends { name: string }>(
  rows: T[],
): T[] {
  return [...rows].sort((a, b) => a.name.localeCompare(b.name));
}

export type ValuationDisplayRow = {
  valued_on: string;
  estimated_value: number;
  currency_code: string;
};

/** Oldest-first rows for the server-rendered BarChart. */
export function valuationChartRows(
  rows: ValuationDisplayRow[],
  limit = 12,
): Array<{ label: string; value: number; display: string }> {
  return sortValuationsNewest(rows)
    .slice(0, limit)
    .reverse()
    .map((row) => ({
      label: row.valued_on.slice(0, 10),
      value: row.estimated_value,
      display: formatEstimatedValue(row.estimated_value, row.currency_code),
    }));
}

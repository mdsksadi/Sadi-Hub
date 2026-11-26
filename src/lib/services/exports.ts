import {
  buildCsvFromColumns,
  exportFilename,
  filterRowsByDate,
  filterRowsByMonth,
  isValidIsoDate,
  parseDateRange,
  summarizeByCurrency,
  type CsvColumn,
  type CsvValue,
  type DateRange,
} from "@/lib/domain/exports";
import { createClient } from "@/lib/supabase/server";

/** Export orchestration: owner-scoped reads + pure projection helpers only. */

export const CSV_RESOURCES = [
  "ledger",
  "accounts",
  "transactions",
  "transfers",
  "loans_given",
  "loans_taken",
  "repayments_given",
  "repayments_taken",
  "contacts",
  "donations",
  "properties",
  "valuations",
  "documents",
] as const;

export type CsvResource = (typeof CSV_RESOURCES)[number];
export type ReportKind = "monthly" | "yearly";

type Row = Record<string, unknown>;
type OwnerTable =
  | "financial_transactions"
  | "accounts"
  | "account_transfers"
  | "loans_given"
  | "loans_taken"
  | "loan_given_repayments"
  | "loan_taken_repayments"
  | "contacts"
  | "donations"
  | "properties"
  | "property_valuations"
  | "documents";
type OwnerView = "monthly_cashflow_v";
type SourceName = OwnerTable | OwnerView;

/** Public, stable error messages; raw SQL and stack traces never reach routes. */
export class ExportError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ExportError";
  }
}

export function parseCsvResource(value: string | null): CsvResource {
  if (!value || !(CSV_RESOURCES as readonly string[]).includes(value)) {
    throw new ExportError(400, "Unknown export resource.");
  }
  return value as CsvResource;
}

export function parseCsvRange(params: URLSearchParams): DateRange {
  const range = parseDateRange({
    from: params.get("from"),
    to: params.get("to"),
  });
  if (!range) {
    throw new ExportError(400, "Invalid date range. Use YYYY-MM-DD.");
  }
  return range;
}

/** PDF reports default to the current UTC year when no dates are supplied. */
export function resolveReport(
  params: URLSearchParams,
  today: Date = new Date(),
): { kind: ReportKind; range: DateRange } {
  const kind = params.get("report");
  if (kind !== "monthly" && kind !== "yearly") {
    throw new ExportError(400, "Unknown report type.");
  }

  const from = params.get("from")?.trim() || null;
  const to = params.get("to")?.trim() || null;
  if (from && !isValidIsoDate(from)) {
    throw new ExportError(400, "Invalid date range. Use YYYY-MM-DD.");
  }
  if (to && !isValidIsoDate(to)) {
    throw new ExportError(400, "Invalid date range. Use YYYY-MM-DD.");
  }
  if (from && to && from > to) {
    throw new ExportError(400, "Invalid date range. Use YYYY-MM-DD.");
  }

  const year = String(today.getUTCFullYear());
  return {
    kind,
    range: {
      from: from ?? `${year}-01-01`,
      to: to ?? `${year}-12-31`,
    },
  };
}

async function fetchOwnerTable(
  ownerId: string,
  table: OwnerTable,
): Promise<Row[]> {
  const supabase = await createClient(false);
  if (!supabase) {
    throw new ExportError(503, "Export data is temporarily unavailable.");
  }
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("owner_id", ownerId);
  if (error) {
    throw new ExportError(503, "Export data is temporarily unavailable.");
  }
  return (data ?? []) as Row[];
}

async function fetchOwnerRows(
  ownerId: string,
  source: SourceName,
): Promise<Row[]> {
  if (source === "monthly_cashflow_v") {
    const supabase = await createClient(false);
    if (!supabase) {
      throw new ExportError(503, "Export data is temporarily unavailable.");
    }
    const { data, error } = await supabase
      .from(source)
      .select("*")
      .eq("owner_id", ownerId);
    if (error) {
      throw new ExportError(503, "Export data is temporarily unavailable.");
    }
    return (data ?? []) as Row[];
  }
  return fetchOwnerTable(ownerId, source);
}

function text(value: unknown): CsvValue {
  if (value === null || value === undefined) return null;
  return typeof value === "string" ? value : String(value);
}

function numeric(value: unknown): CsvValue {
  if (value === null || value === undefined) return null;
  return typeof value === "number" || typeof value === "string" ? value : null;
}

const column = (header: string, key: string): CsvColumn<Row> => ({
  header,
  value: (row) => text(row[key]),
});

const numberColumn = (header: string, key: string): CsvColumn<Row> => ({
  header,
  value: (row) => numeric(row[key]),
});

const boolColumn = (header: string, key: string): CsvColumn<Row> => ({
  header,
  value: (row) =>
    row[key] === true ? "true" : row[key] === false ? "false" : "",
});

const tagsColumn = (header: string, key: string): CsvColumn<Row> => ({
  header,
  value: (row) => (Array.isArray(row[key]) ? row[key].join("; ") : ""),
});

const ledgerColumns: readonly CsvColumn<Row>[] = [
  column("id", "id"),
  column("business_date", "business_date"),
  column("account_id", "account_id"),
  column("transaction_type", "transaction_type"),
  numberColumn("direction", "direction"),
  numberColumn("amount", "amount"),
  column("currency_code", "currency_code"),
  column("reporting_currency", "reporting_currency"),
  numberColumn("exchange_rate_to_reporting", "exchange_rate_to_reporting"),
  numberColumn("amount_reporting", "amount_reporting"),
  column("category_id", "category_id"),
  column("reference_type", "reference_type"),
  column("reference_id", "reference_id"),
  column("transfer_id", "transfer_id"),
  column("description", "description"),
  column("notes", "notes"),
  boolColumn("is_reversal", "is_reversal"),
  column("reverses_transaction_id", "reverses_transaction_id"),
  column("created_at", "created_at"),
  column("created_by", "created_by"),
];

type ResourceConfig = {
  source: SourceName;
  dateColumn: string;
  columns: readonly CsvColumn<Row>[];
};

/**
 * `transactions` is an alias of `ledger` for callers that think in terms of
 * the UI label. Storage paths, owner ids and auth emails are deliberately
 * absent from every projection.
 */
const RESOURCES: Record<CsvResource, ResourceConfig> = {
  ledger: {
    source: "financial_transactions",
    dateColumn: "business_date",
    columns: ledgerColumns,
  },
  transactions: {
    source: "financial_transactions",
    dateColumn: "business_date",
    columns: ledgerColumns,
  },
  accounts: {
    source: "accounts",
    dateColumn: "opening_date",
    columns: [
      column("id", "id"),
      column("name", "name"),
      column("account_type", "account_type"),
      column("country_code", "country_code"),
      column("currency_code", "currency_code"),
      numberColumn("opening_balance", "opening_balance"),
      column("opening_date", "opening_date"),
      column("description", "description"),
      boolColumn("is_active", "is_active"),
      column("created_at", "created_at"),
      column("updated_at", "updated_at"),
    ],
  },
  transfers: {
    source: "account_transfers",
    dateColumn: "transfer_date",
    columns: [
      column("id", "id"),
      column("transfer_date", "transfer_date"),
      column("source_account_id", "source_account_id"),
      column("destination_account_id", "destination_account_id"),
      numberColumn("source_amount", "source_amount"),
      column("source_currency", "source_currency"),
      numberColumn("destination_amount", "destination_amount"),
      column("destination_currency", "destination_currency"),
      numberColumn("exchange_rate", "exchange_rate"),
      numberColumn("fee_amount", "fee_amount"),
      column("reference_number", "reference_number"),
      column("notes", "notes"),
      column("out_ledger_id", "out_ledger_id"),
      column("in_ledger_id", "in_ledger_id"),
      column("fee_ledger_id", "fee_ledger_id"),
      column("created_at", "created_at"),
    ],
  },
  loans_given: {
    source: "loans_given",
    dateColumn: "date_given",
    columns: [
      column("id", "id"),
      column("date_given", "date_given"),
      column("contact_id", "contact_id"),
      numberColumn("amount", "amount"),
      column("currency_code", "currency_code"),
      column("reason", "reason"),
      column("payment_method", "payment_method"),
      column("source_account_id", "source_account_id"),
      column("expected_repayment_date", "expected_repayment_date"),
      column("reference_number", "reference_number"),
      column("notes", "notes"),
      column("cancelled_at", "cancelled_at"),
      column("created_at", "created_at"),
      column("updated_at", "updated_at"),
    ],
  },
  loans_taken: {
    source: "loans_taken",
    dateColumn: "date_borrowed",
    columns: [
      column("id", "id"),
      column("date_borrowed", "date_borrowed"),
      column("lender_contact_id", "lender_contact_id"),
      numberColumn("amount", "amount"),
      column("currency_code", "currency_code"),
      column("reason", "reason"),
      column("expected_repayment_date", "expected_repayment_date"),
      column("receiving_account_id", "receiving_account_id"),
      column("agreement_details", "agreement_details"),
      column("notes", "notes"),
      column("cancelled_at", "cancelled_at"),
      column("created_at", "created_at"),
      column("updated_at", "updated_at"),
    ],
  },
  repayments_given: {
    source: "loan_given_repayments",
    dateColumn: "repayment_date",
    columns: [
      column("id", "id"),
      column("repayment_date", "repayment_date"),
      column("loan_id", "loan_id"),
      numberColumn("amount", "amount"),
      column("receiving_account_id", "receiving_account_id"),
      column("payment_method", "payment_method"),
      column("reference_number", "reference_number"),
      column("notes", "notes"),
      column("cancelled_at", "cancelled_at"),
      column("created_at", "created_at"),
    ],
  },
  repayments_taken: {
    source: "loan_taken_repayments",
    dateColumn: "payment_date",
    columns: [
      column("id", "id"),
      column("payment_date", "payment_date"),
      column("loan_id", "loan_id"),
      numberColumn("amount", "amount"),
      column("source_account_id", "source_account_id"),
      column("payment_method", "payment_method"),
      column("reference_number", "reference_number"),
      column("notes", "notes"),
      column("cancelled_at", "cancelled_at"),
      column("created_at", "created_at"),
    ],
  },
  // Contact email addresses are intentionally not exported.
  contacts: {
    source: "contacts",
    dateColumn: "created_at",
    columns: [
      column("id", "id"),
      column("full_name", "full_name"),
      column("contact_type", "contact_type"),
      column("phone", "phone"),
      column("address", "address"),
      column("country_code", "country_code"),
      column("notes", "notes"),
      column("archived_at", "archived_at"),
      column("created_at", "created_at"),
      column("updated_at", "updated_at"),
    ],
  },
  donations: {
    source: "donations",
    dateColumn: "donation_date",
    columns: [
      column("id", "id"),
      column("donation_date", "donation_date"),
      column("recipient_name", "recipient_name"),
      column("recipient_type", "recipient_type"),
      column("contact_id", "contact_id"),
      numberColumn("amount", "amount"),
      column("currency_code", "currency_code"),
      column("country_code", "country_code"),
      column("purpose", "purpose"),
      column("category_id", "category_id"),
      column("source_account_id", "source_account_id"),
      column("payment_method", "payment_method"),
      column("reference_number", "reference_number"),
      column("notes", "notes"),
      column("created_at", "created_at"),
      column("created_by", "created_by"),
    ],
  },
  properties: {
    source: "properties",
    dateColumn: "purchase_date",
    columns: [
      column("id", "id"),
      column("name", "name"),
      column("country_code", "country_code"),
      column("division", "division"),
      column("district", "district"),
      column("upazila", "upazila"),
      column("union_name", "union_name"),
      column("village", "village"),
      column("mouza", "mouza"),
      column("khatian_number", "khatian_number"),
      column("dag_number", "dag_number"),
      column("land_classification", "land_classification"),
      numberColumn("total_area", "total_area"),
      column("area_unit", "area_unit"),
      column("purchase_date", "purchase_date"),
      numberColumn("purchase_price", "purchase_price"),
      column("currency_code", "currency_code"),
      numberColumn("current_estimated_value", "current_estimated_value"),
      column("notes", "notes"),
      column("created_at", "created_at"),
      column("updated_at", "updated_at"),
    ],
  },
  valuations: {
    source: "property_valuations",
    dateColumn: "valued_on",
    columns: [
      column("id", "id"),
      column("property_id", "property_id"),
      column("valued_on", "valued_on"),
      numberColumn("estimated_value", "estimated_value"),
      column("currency_code", "currency_code"),
      column("source", "source"),
      boolColumn("is_verified", "is_verified"),
      column("notes", "notes"),
      column("created_at", "created_at"),
    ],
  },
  // `storage_path` is never exported: it would expose private bucket layout.
  documents: {
    source: "documents",
    dateColumn: "uploaded_at",
    columns: [
      column("id", "id"),
      column("file_name", "file_name"),
      column("mime_type", "mime_type"),
      numberColumn("size_bytes", "size_bytes"),
      column("category", "category"),
      column("description", "description"),
      column("uploaded_at", "uploaded_at"),
      tagsColumn("tags", "tags"),
      column("related_contact_id", "related_contact_id"),
      column("related_transaction_id", "related_transaction_id"),
      column("related_property_id", "related_property_id"),
      column("related_loan_given_id", "related_loan_given_id"),
      column("related_loan_taken_id", "related_loan_taken_id"),
      column("related_donation_id", "related_donation_id"),
    ],
  },
};

export async function exportOwnerCsv(
  ownerId: string,
  resource: CsvResource,
  range: DateRange,
  today: Date = new Date(),
): Promise<{ body: string; filename: string }> {
  const config = RESOURCES[resource];
  const rows = await fetchOwnerRows(ownerId, config.source);
  const filtered = filterRowsByDate(rows, config.dateColumn, range);
  const date = range.to ?? today.toISOString().slice(0, 10);
  return {
    body: buildCsvFromColumns(config.columns, filtered),
    filename: exportFilename(resource, date, "csv"),
  };
}

function asNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asCurrency(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export type ReportData = {
  kind: ReportKind;
  range: DateRange;
  summary: ReturnType<typeof summarizeByCurrency>;
  cashflowMonths: number;
  donationCount: number;
};

/** Data only: the PDF bytes are built in the handler after a lazy import. */
export async function getOwnerReportData(
  ownerId: string,
  kind: ReportKind,
  range: DateRange,
): Promise<ReportData> {
  const [cashflowRows, donationRows] = await Promise.all([
    fetchOwnerRows(ownerId, "monthly_cashflow_v"),
    fetchOwnerRows(ownerId, "donations"),
  ]);

  const cashflow = filterRowsByMonth(cashflowRows, "month", range).map(
    (row) => ({
      currency_code: asCurrency(row.currency_code),
      income_amount: asNumber(row.income_amount),
      expense_amount: asNumber(row.expense_amount),
      net_amount: asNumber(row.net_amount),
    }),
  );
  const donations = filterRowsByDate(donationRows, "donation_date", range).map(
    (row) => ({
      currency_code: asCurrency(row.currency_code),
      amount: asNumber(row.amount),
    }),
  );

  return {
    kind,
    range,
    summary: summarizeByCurrency(cashflow, donations),
    cashflowMonths: cashflow.length,
    donationCount: donations.length,
  };
}

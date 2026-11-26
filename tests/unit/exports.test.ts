import { describe, expect, it } from "vitest";
import {
  buildCsv,
  buildCsvFromColumns,
  buildCsvRow,
  escapeCsvCell,
  exportFilename,
  filterRowsByDate,
  filterRowsByMonth,
  isValidIsoDate,
  parseDateRange,
  safeFilenamePart,
  sanitizePdfText,
  summarizeByCurrency,
} from "@/lib/domain/exports";

describe("CSV escaping", () => {
  it("quotes commas, quotes and line breaks per RFC 4180", () => {
    expect(escapeCsvCell("plain")).toBe("plain");
    expect(escapeCsvCell("a,b")).toBe('"a,b"');
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvCell("first\r\nsecond")).toBe('"first\r\nsecond"');
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(undefined)).toBe("");
  });

  it("neutralises spreadsheet formulas and then applies CSV quoting", () => {
    expect(escapeCsvCell("=1+1")).toBe("'=1+1");
    expect(escapeCsvCell("+cmd")).toBe("'+cmd");
    expect(escapeCsvCell("-12.50")).toBe("'-12.50");
    expect(escapeCsvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(escapeCsvCell('=HYPERLINK("a,b")')).toBe(`"'=HYPERLINK(""a,b"")"`);
  });

  it("builds BOM-prefixed CRLF rows with a stable column order", () => {
    expect(buildCsvRow(["a", "b,c"])).toBe('a,"b,c"');
    expect(
      buildCsv([
        ["h1", "h2"],
        ["v1", "v2"],
      ]),
    ).toBe("\uFEFFh1,h2\r\nv1,v2\r\n");
    expect(buildCsv([])).toBe("\uFEFF");

    const csv = buildCsvFromColumns(
      [
        { header: "first", value: (row: { a: string; b: string }) => row.a },
        { header: "second", value: (row: { a: string; b: string }) => row.b },
      ],
      [{ a: "one", b: "two" }],
    );
    expect(csv).toBe("\uFEFFfirst,second\r\none,two\r\n");
  });
});

describe("date parameters", () => {
  it("accepts real calendar dates only", () => {
    expect(isValidIsoDate("2026-02-28")).toBe(true);
    expect(isValidIsoDate("2026-02-30")).toBe(false);
    expect(isValidIsoDate("2026/01/01")).toBe(false);
  });

  it("rejects inverted and malformed ranges but allows open bounds", () => {
    expect(parseDateRange({ from: "2026-01-01", to: "2026-12-31" })).toEqual({
      from: "2026-01-01",
      to: "2026-12-31",
    });
    expect(parseDateRange({ from: "2026-05-01", to: "2026-04-01" })).toBeNull();
    expect(parseDateRange({ from: "not-a-date" })).toBeNull();
    expect(parseDateRange({ to: "2026-01-01" })).toEqual({
      from: null,
      to: "2026-01-01",
    });
  });

  it("filters DATE columns and YYYY-MM view columns", () => {
    const rows = [
      { business_date: "2025-12-31", month: "2025-12" },
      { business_date: "2026-01-05", month: "2026-01" },
      { business_date: "2026-03-01", month: "2026-03" },
    ];
    const range = { from: "2026-01-01", to: "2026-02-28" };
    expect(filterRowsByDate(rows, "business_date", range)).toHaveLength(1);
    expect(filterRowsByMonth(rows, "month", range)).toHaveLength(1);
    expect(filterRowsByDate(rows, "missing", { from: null, to: null })).toEqual(
      rows,
    );
  });
});

describe("filename safety", () => {
  it("strips separators, paths and header-injection characters", () => {
    expect(safeFilenamePart("../../etc/passwd")).toBe("etc-passwd");
    expect(safeFilenamePart("ledger\r\nX-Evil: 1")).toBe("ledger-x-evil-1");
    expect(exportFilename("../../secret", "2026-11-25", "csv")).toBe(
      "sadi-hub-secret-2026-11-25.csv",
    );
    expect(exportFilename("monthly", "bad", "pdf")).toBe(
      "sadi-hub-monthly-bad.pdf",
    );
  });
});

describe("PDF text and summaries", () => {
  it("sanitizes control characters and truncates text", () => {
    expect(sanitizePdfText("a\u0000b\nc\rd", 40)).toBe("a b c d");
    expect(sanitizePdfText("  caf\u00e9  ")).toBe("caf\u00e9");
    expect(sanitizePdfText("\u09b9\u09c7\u09b2\u09cb", 40)).toBe("?".repeat(4));
    expect(sanitizePdfText("x".repeat(50), 10)).toBe("xxxxxxx...");
  });

  it("groups by currency without summing EUR and BDT", () => {
    const summary = summarizeByCurrency(
      [
        {
          currency_code: "EUR",
          income_amount: 10,
          expense_amount: 4,
          net_amount: 6,
        },
        {
          currency_code: "BDT",
          income_amount: 1000,
          expense_amount: 250,
          net_amount: 750,
        },
        {
          currency_code: "eur",
          income_amount: 1.25,
          expense_amount: 0,
          net_amount: 1.25,
        },
      ],
      [
        { currency_code: "EUR", amount: 3 },
        { currency_code: "BDT", amount: 200 },
      ],
    );

    expect(summary).toEqual([
      {
        currency: "BDT",
        income: 1000,
        expense: 250,
        net: 750,
        donations: 200,
      },
      {
        currency: "EUR",
        income: 11.25,
        expense: 4,
        net: 7.25,
        donations: 3,
      },
    ]);
  });
});

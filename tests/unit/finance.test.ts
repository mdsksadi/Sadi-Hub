import { describe, expect, it } from "vitest";
import {
  balanceAfter,
  cashflowFor,
  isCashNeutralType,
  isExpenseType,
  isIncomeType,
  monthLabel,
  monthlyTotals,
  parseAmount,
  roundAmount,
  totalsByCurrency,
  translateAmount,
} from "@/lib/domain/finance";
import {
  accountSchema,
  exchangeRateSchema,
  financeCategorySchema,
  incomeSchema,
  transferSchema,
} from "@/lib/validation/finance-schemas";
import type { LedgerTransactionType } from "../../types/supabase";

const ACCOUNT_ID = "00000000-0000-4000-8000-000000000001";
const OTHER_ACCOUNT_ID = "00000000-0000-4000-8000-000000000002";

describe("ledger classification", () => {
  it("treats only income as revenue", () => {
    expect(isIncomeType("income")).toBe(true);
    expect(isIncomeType("expense")).toBe(false);
    expect(isIncomeType("donation")).toBe(false);
  });

  it("treats expenses and donations as costs", () => {
    expect(isExpenseType("expense")).toBe(true);
    expect(isExpenseType("donation")).toBe(true);
    expect(isExpenseType("transfer_out")).toBe(false);
  });

  it("treats transfers and loan principal as cash-only movements", () => {
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
    }
    expect(isCashNeutralType("income")).toBe(false);
    expect(isCashNeutralType("donation")).toBe(false);
    expect(isCashNeutralType("correction")).toBe(false);
    expect(isCashNeutralType("reversal")).toBe(false);
  });

  it("gives neutral movements zero cashflow contribution", () => {
    expect(cashflowFor("income", 100, 120)).toEqual({
      income: 100,
      expense: 0,
      incomeReporting: 120,
      expenseReporting: 0,
    });
    expect(cashflowFor("donation", 25, 30)).toEqual({
      income: 0,
      expense: 25,
      incomeReporting: 0,
      expenseReporting: 30,
    });
    expect(cashflowFor("reversal", 25, 30)).toEqual({
      income: 25,
      expense: 0,
      incomeReporting: 30,
      expenseReporting: 0,
    });
    expect(cashflowFor("correction", 25, 30)).toEqual({
      income: 0,
      expense: 25,
      incomeReporting: 0,
      expenseReporting: 30,
    });
    expect(cashflowFor("transfer_in", 500, 600)).toEqual({
      income: 0,
      expense: 0,
      incomeReporting: 0,
      expenseReporting: 0,
    });
  });
});

describe("money helpers", () => {
  it("parses only positive decimals with at most four places", () => {
    expect(parseAmount("10")).toBe(10);
    expect(parseAmount(" 10.5000 ")).toBe(10.5);
    expect(parseAmount("0")).toBeNull();
    expect(parseAmount("-1")).toBeNull();
    expect(parseAmount("1.12345")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
  });

  it("rounds translated amounts to four decimals", () => {
    expect(roundAmount(1.12345, 4)).toBe(1.1235);
    expect(translateAmount(10.25, 2)).toBe(20.5);
    expect(translateAmount(1, 1.23456789)).toBe(1.2346);
  });

  it("applies signed movements to an opening balance", () => {
    expect(balanceAfter(100, [50, -20, -5])).toBe(125);
    expect(balanceAfter(0, [])).toBe(0);
  });

  it("keeps currency totals separate", () => {
    expect(
      totalsByCurrency([
        { currency_code: "EUR", amount: 10 },
        { currency_code: "BDT", amount: 1000 },
        { currency_code: "eur", amount: 5 },
      ]),
    ).toEqual({ EUR: 15, BDT: 1000 });
  });
});

describe("month helpers", () => {
  it("groups and sorts monthly totals", () => {
    const rows = [
      { date: "2026-02-03", value: 5 },
      { date: "2026-01-10", value: 2 },
      { date: "2026-01-31", value: 3 },
    ];
    expect(
      monthlyTotals(
        rows,
        (row) => row.date,
        (row) => row.value,
      ),
    ).toEqual([
      { month: "2026-01", total: 5 },
      { month: "2026-02", total: 5 },
    ]);
  });

  it("labels months without interpreting them as local dates", () => {
    expect(monthLabel("2026-01")).toBe("Jan 2026");
    expect(monthLabel("not-a-month")).toBe("not-a-month");
  });
});

describe("finance form schemas", () => {
  const validAccount = {
    id: "",
    name: "Main bank",
    countryCode: "bd",
    currencyCode: "bdt",
    accountType: "bank",
    openingBalance: "-100.5000",
    openingDate: "",
    description: "",
    isActive: true,
  };

  it("normalises currency codes and allows zero or negative opening balances", () => {
    const result = accountSchema.safeParse(validAccount);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.countryCode).toBe("BD");
      expect(result.data.currencyCode).toBe("BDT");
      expect(result.data.openingBalance).toBe("-100.5000");
    }
  });

  it("rejects too many decimals in an opening balance", () => {
    expect(
      accountSchema.safeParse({
        ...validAccount,
        openingBalance: "10.12345",
      }).success,
    ).toBe(false);
  });

  it("accepts an empty optional category id and rejects an unknown kind", () => {
    expect(
      financeCategorySchema.safeParse({
        id: "",
        name: "Salary",
        kind: "income",
        parentId: "",
        icon: "",
        isActive: true,
      }).success,
    ).toBe(true);
    expect(
      financeCategorySchema.safeParse({
        id: "",
        name: "Salary",
        kind: "revenue",
        parentId: "",
        icon: "",
        isActive: true,
      }).success,
    ).toBe(false);
  });

  const validMovement = {
    accountId: ACCOUNT_ID,
    amount: "25.5000",
    businessDate: "2026-01-15",
    categoryId: "",
    description: "Groceries",
    notes: "",
    referenceNumber: "",
  };

  it("validates income and expense movements", () => {
    expect(incomeSchema.safeParse(validMovement).success).toBe(true);
    expect(
      incomeSchema.safeParse({ ...validMovement, amount: "0" }).success,
    ).toBe(false);
    expect(
      incomeSchema.safeParse({ ...validMovement, businessDate: "13/01/2026" })
        .success,
    ).toBe(false);
  });

  const validTransfer = {
    sourceAccountId: ACCOUNT_ID,
    destinationAccountId: OTHER_ACCOUNT_ID,
    sourceAmount: "100.0000",
    destinationAmount: "11000.0000",
    exchangeRate: "110.00000000",
    feeAmount: "0",
    transferDate: "2026-01-15",
    referenceNumber: "TRX-1",
    notes: "",
  };

  it("requires two distinct accounts and a positive rate", () => {
    expect(transferSchema.safeParse(validTransfer).success).toBe(true);
    expect(
      transferSchema.safeParse({
        ...validTransfer,
        destinationAccountId: ACCOUNT_ID,
      }).success,
    ).toBe(false);
    expect(
      transferSchema.safeParse({ ...validTransfer, exchangeRate: "0" }).success,
    ).toBe(false);
  });

  it("requires a positive snapshot rate between different currencies", () => {
    expect(
      exchangeRateSchema.safeParse({
        fromCurrency: "eur",
        toCurrency: "bdt",
        rate: "110.12345678",
        effectiveDate: "2026-01-01",
        source: "Central bank",
      }).success,
    ).toBe(true);
    expect(
      exchangeRateSchema.safeParse({
        fromCurrency: "EUR",
        toCurrency: "EUR",
        rate: "1",
        effectiveDate: "2026-01-01",
        source: "Central bank",
      }).success,
    ).toBe(false);
  });
});

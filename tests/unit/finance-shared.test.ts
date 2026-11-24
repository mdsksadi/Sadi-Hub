import { describe, expect, it } from "vitest";
import {
  balanceAfter,
  cashflowFor,
  isCashNeutralType,
  isExpenseType,
  isIncomeType,
  monthlyTotals,
  parseAmount,
  totalsByCurrency,
} from "@/lib/domain/finance";
import { feeAmount, moneyAmount } from "@/lib/validation/finance";

describe("shared finance rules", () => {
  it("classifies ledger types without double counting principal movements", () => {
    expect(isIncomeType("income")).toBe(true);
    expect(isIncomeType("reversal")).toBe(true);
    expect(isExpenseType("donation")).toBe(true);
    expect(isExpenseType("expense")).toBe(true);
    expect(isExpenseType("correction")).toBe(true);
    expect(cashflowFor("reversal", 100, 100)).toEqual({
      income: 100,
      expense: 0,
      incomeReporting: 100,
      expenseReporting: 0,
    });
    expect(cashflowFor("correction", 100, 100)).toEqual({
      income: 0,
      expense: 100,
      incomeReporting: 0,
      expenseReporting: 100,
    });
    for (const type of [
      "transfer_in",
      "transfer_out",
      "loan_disbursed",
      "loan_repayment_received",
      "borrowing_received",
      "borrowing_repayment_paid",
    ] as const) {
      expect(isCashNeutralType(type)).toBe(true);
      expect(cashflowFor(type, 100, 100)).toEqual({
        income: 0,
        expense: 0,
        incomeReporting: 0,
        expenseReporting: 0,
      });
    }
  });

  it("parses only positive decimal amounts", () => {
    expect(parseAmount("12.3456")).toBe(12.3456);
    expect(parseAmount("0")).toBeNull();
    expect(parseAmount("-1")).toBeNull();
    expect(parseAmount("1.00000")).toBeNull();
    expect(balanceAfter(100, [-25, 10])).toBe(85);
  });

  it("groups monthly totals and keeps currencies separate", () => {
    const rows = [
      { business_date: "2026-01-05", currency_code: "EUR", amount: 10 },
      { business_date: "2026-01-20", currency_code: "BDT", amount: 500 },
      { business_date: "2026-02-02", currency_code: "EUR", amount: 5 },
    ];
    expect(
      monthlyTotals(
        rows,
        (row) => row.business_date,
        (row) => row.amount,
      ),
    ).toEqual([
      { month: "2026-01", total: 510 },
      { month: "2026-02", total: 5 },
    ]);
    expect(totalsByCurrency(rows)).toEqual({ EUR: 15, BDT: 500 });
  });

  it("validates money strings as text", () => {
    expect(moneyAmount.safeParse("42.50").success).toBe(true);
    expect(moneyAmount.safeParse("42.12345").success).toBe(false);
    expect(feeAmount.safeParse("0").success).toBe(true);
    expect(feeAmount.safeParse("-1").success).toBe(false);
  });
});

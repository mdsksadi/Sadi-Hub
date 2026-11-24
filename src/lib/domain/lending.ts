import type {
  ContactLendingSummary,
  LoanGivenStatus,
  LoanTakenStatus,
} from "../../../types/supabase";
import { roundAmount } from "./finance";

/** Exact status unions from the two status views. */
export type GivenLoanStatus = LoanGivenStatus["status"];
export type TakenLoanStatus = LoanTakenStatus["status"];
export type LoanStatus = GivenLoanStatus | TakenLoanStatus;

export type RepaymentLike = {
  amount: number;
  cancelled_at?: string | null;
};

export type LoanStatusInput = {
  amount: number;
  totalRepaid: number;
  expectedRepaymentDate: string | null;
  cancelledAt: string | null;
};

export type ContactLoanLike = {
  owner_id: string;
  contact_id: string;
  full_name: string;
  contact_type: "individual" | "organization";
  currency_code: string;
  amount: number;
  total_repaid: number;
  date: string;
  expectedRepaymentDate?: string | null;
  cancelled_at?: string | null;
};

/** Cancelled repayments are excluded from every outstanding calculation. */
export function totalRepaid(repayments: RepaymentLike[]): number {
  return roundAmount(
    repayments.reduce(
      (sum, repayment) =>
        repayment.cancelled_at == null ? sum + repayment.amount : sum,
      0,
    ),
    4,
  );
}

/** Mirrors `amount - total_repaid` in the SQL status views. */
export function remainingPrincipal(
  amount: number,
  repayments: RepaymentLike[],
): number {
  return roundAmount(amount - totalRepaid(repayments), 4);
}

/** ISO dates are compared lexicographically, so no timezone is involved. */
export function isOverdue(
  expectedRepaymentDate: string | null,
  outstanding: number,
  today: Date = new Date(),
): boolean {
  if (!expectedRepaymentDate) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expectedRepaymentDate)) return false;
  if (outstanding <= 0) return false;
  return expectedRepaymentDate < today.toISOString().slice(0, 10);
}

function statusFor(
  input: LoanStatusInput,
  fallback: "Pending" | "Active",
  today: Date,
): LoanStatus {
  const outstanding = roundAmount(input.amount - input.totalRepaid, 4);
  if (input.cancelledAt != null) return "Cancelled";
  if (outstanding <= 0) return "Fully Repaid";
  if (outstanding < input.amount) return "Partially Repaid";
  if (isOverdue(input.expectedRepaymentDate, outstanding, today)) {
    return "Overdue";
  }
  return fallback;
}

export function loanGivenStatus(
  input: LoanStatusInput,
  today: Date = new Date(),
): GivenLoanStatus {
  return statusFor(input, "Pending", today) as GivenLoanStatus;
}

export function loanTakenStatus(
  input: LoanStatusInput,
  today: Date = new Date(),
): TakenLoanStatus {
  return statusFor(input, "Active", today) as TakenLoanStatus;
}

export function loanStatus(
  input: LoanStatusInput & { kind: "given" },
  today?: Date,
): GivenLoanStatus;
export function loanStatus(
  input: LoanStatusInput & { kind: "taken" },
  today?: Date,
): TakenLoanStatus;
export function loanStatus(
  input: LoanStatusInput & { kind: "given" | "taken" },
  today: Date = new Date(),
): LoanStatus {
  return statusFor(input, input.kind === "given" ? "Pending" : "Active", today);
}

/**
 * Recomputes the contact/currency summary used by `contact_lending_summary_v`.
 * Rows are never combined across currencies, and cancelled loans are ignored.
 */
export function contactTotals(
  loans: ContactLoanLike[],
): ContactLendingSummary[] {
  const grouped = new Map<string, ContactLendingSummary>();

  for (const loan of loans) {
    if (loan.cancelled_at != null) continue;
    const currency = loan.currency_code.toUpperCase();
    const key = `${loan.owner_id}\u0000${loan.contact_id}\u0000${currency}`;
    const current = grouped.get(key);
    const repaid = roundAmount(loan.total_repaid, 4);
    const outstanding = roundAmount(loan.amount - repaid, 4);
    const overdue = isOverdue(loan.expectedRepaymentDate ?? null, outstanding)
      ? outstanding
      : 0;

    if (current) {
      current.lent_amount = roundAmount(current.lent_amount + loan.amount, 4);
      current.repaid_amount = roundAmount(current.repaid_amount + repaid, 4);
      current.outstanding_amount = roundAmount(
        current.outstanding_amount + outstanding,
        4,
      );
      current.overdue_amount = roundAmount(current.overdue_amount + overdue, 4);
      current.loan_count += 1;
      if (loan.date < current.first_date) current.first_date = loan.date;
      if (loan.date > current.last_date) current.last_date = loan.date;
      continue;
    }

    grouped.set(key, {
      owner_id: loan.owner_id,
      contact_id: loan.contact_id,
      full_name: loan.full_name,
      contact_type: loan.contact_type,
      currency_code: currency,
      lent_amount: roundAmount(loan.amount, 4),
      repaid_amount: repaid,
      outstanding_amount: outstanding,
      overdue_amount: roundAmount(overdue, 4),
      loan_count: 1,
      first_date: loan.date,
      last_date: loan.date,
    });
  }

  return [...grouped.values()].sort(
    (a, b) =>
      a.full_name.localeCompare(b.full_name) ||
      a.currency_code.localeCompare(b.currency_code),
  );
}

import type { Metadata } from "next";
import {
  LoanTakenForm,
  RepaymentForm,
} from "@/components/finance/lending-forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireOwner } from "@/lib/auth/owner";
import {
  getActiveAccounts,
  getContacts,
  getLoansTaken,
  getTakenRepayments,
} from "@/lib/data/lending";
import { roundAmount } from "@/lib/domain/finance";
import type { TakenLoanStatus } from "@/lib/domain/lending";
import { formatMoney } from "@/lib/domain/money";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Borrowing",
  robots: { index: false },
};

function statusClass(status: TakenLoanStatus): string {
  switch (status) {
    case "Cancelled":
      return "bg-muted text-muted-foreground line-through";
    case "Fully Repaid":
      return "bg-emerald-500/10 text-emerald-600";
    case "Partially Repaid":
      return "bg-sky-500/10 text-sky-600";
    case "Overdue":
      return "bg-red-500/10 text-red-600";
    default:
      return "bg-amber-500/10 text-amber-600";
  }
}

export default async function AdminBorrowingPage() {
  const owner = await requireOwner();
  const today = new Date().toISOString().slice(0, 10);
  const [contacts, accounts, loans] = await Promise.all([
    getContacts(owner.userId),
    getActiveAccounts(owner.userId),
    getLoansTaken(owner.userId),
  ]);
  const repayments = await getTakenRepayments(
    owner.userId,
    loans.map((loan) => loan.id),
  );

  const contactNames = new Map(
    contacts.map((contact) => [contact.id, contact.full_name]),
  );
  const repaymentsByLoan = new Map<string, typeof repayments>();
  for (const repayment of repayments) {
    const list = repaymentsByLoan.get(repayment.loan_id) ?? [];
    list.push(repayment);
    repaymentsByLoan.set(repayment.loan_id, list);
  }

  const totals = new Map<
    string,
    { borrowed: number; repaid: number; outstanding: number }
  >();
  for (const loan of loans) {
    const current = totals.get(loan.currency_code) ?? {
      borrowed: 0,
      repaid: 0,
      outstanding: 0,
    };
    current.borrowed = roundAmount(current.borrowed + loan.amount, 4);
    current.repaid = roundAmount(current.repaid + loan.total_repaid, 4);
    current.outstanding = roundAmount(
      current.outstanding + loan.outstanding,
      4,
    );
    totals.set(loan.currency_code, current);
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Borrowing</h1>
        <p className="text-muted-foreground mt-2">
          Money you borrowed. Payables are tracked per currency and never mixed
          with receivables.
        </p>
      </header>

      {totals.size > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...totals.entries()].map(([currency, total]) => (
            <Card key={currency}>
              <CardHeader className="pb-1">
                <CardTitle>{currency}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p>
                  Borrowed:{" "}
                  <strong>{formatMoney(total.borrowed, currency)}</strong>
                </p>
                <p>
                  Repaid: <strong>{formatMoney(total.repaid, currency)}</strong>
                </p>
                <p>
                  Outstanding:{" "}
                  <strong>{formatMoney(total.outstanding, currency)}</strong>
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>New loan taken</CardTitle>
        </CardHeader>
        <CardContent>
          {(contacts.length === 0 || accounts.length === 0) && (
            <p className="mb-4 text-sm text-amber-600">
              Add a contact and an active account first.
            </p>
          )}
          <LoanTakenForm
            contacts={contacts}
            accounts={accounts}
            today={today}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Loans taken{" "}
            <span className="text-muted-foreground text-sm font-normal">
              ({loans.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loans.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No borrowings recorded yet.
            </p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Lender</TH>
                  <TH>Principal</TH>
                  <TH>Repaid</TH>
                  <TH>Outstanding</TH>
                  <TH>Status</TH>
                  <TH>Dates</TH>
                  <TH>Repayments</TH>
                </TR>
              </THead>
              <TBody>
                {loans.map((loan) => {
                  const history = repaymentsByLoan.get(loan.id) ?? [];
                  return (
                    <TR key={loan.id}>
                      <TD className="font-medium">
                        {contactNames.get(loan.lender_contact_id) ??
                          "Unknown contact"}
                      </TD>
                      <TD>{formatMoney(loan.amount, loan.currency_code)}</TD>
                      <TD>
                        {formatMoney(loan.total_repaid, loan.currency_code)}
                      </TD>
                      <TD>
                        {formatMoney(loan.outstanding, loan.currency_code)}
                      </TD>
                      <TD>
                        <Badge className={statusClass(loan.status)}>
                          {loan.status}
                        </Badge>
                      </TD>
                      <TD className="text-muted-foreground text-xs">
                        <div>Borrowed: {loan.date_borrowed.slice(0, 10)}</div>
                        <div>
                          Due:{" "}
                          {loan.expected_repayment_date?.slice(0, 10) ?? "—"}
                        </div>
                      </TD>
                      <TD className="min-w-64">
                        {history.length > 0 && (
                          <ul className="text-muted-foreground mb-2 space-y-1 text-xs">
                            {history.slice(0, 3).map((repayment) => (
                              <li key={repayment.id}>
                                {repayment.payment_date.slice(0, 10)} ·{" "}
                                {formatMoney(
                                  repayment.amount,
                                  loan.currency_code,
                                )}
                                {repayment.cancelled_at ? " (cancelled)" : ""}
                              </li>
                            ))}
                            {history.length > 3 && (
                              <li>+{history.length - 3} more</li>
                            )}
                          </ul>
                        )}
                        <RepaymentForm
                          mode="taken"
                          loanId={loan.id}
                          currency={loan.currency_code}
                          outstanding={loan.outstanding}
                          accounts={accounts}
                          today={today}
                        />
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

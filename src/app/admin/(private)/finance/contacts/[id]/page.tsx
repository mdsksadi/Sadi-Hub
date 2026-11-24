import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireOwner } from "@/lib/auth/owner";
import {
  getContact,
  getContactLendingSummaries,
  getGivenRepayments,
  getLoansGiven,
  getLoansTaken,
  getTakenRepayments,
} from "@/lib/data/lending";
import { isOverdue } from "@/lib/domain/lending";
import { formatMoney } from "@/lib/domain/money";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Contact history",
  robots: { index: false },
};

type Props = { params: Promise<{ id: string }> };

export default async function ContactHistoryPage({ params }: Props) {
  const { id } = await params;
  const owner = await requireOwner();
  const contact = await getContact(owner.userId, id);
  if (!contact) notFound();

  const [given, taken, summaries] = await Promise.all([
    getLoansGiven(owner.userId),
    getLoansTaken(owner.userId),
    getContactLendingSummaries(owner.userId),
  ]);
  const contactGiven = given.filter((loan) => loan.contact_id === contact.id);
  const contactTaken = taken.filter(
    (loan) => loan.lender_contact_id === contact.id,
  );
  const [givenRepayments, takenRepayments] = await Promise.all([
    getGivenRepayments(
      owner.userId,
      contactGiven.map((loan) => loan.id),
    ),
    getTakenRepayments(
      owner.userId,
      contactTaken.map((loan) => loan.id),
    ),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const givenByLoan = new Map<string, typeof givenRepayments>();
  for (const repayment of givenRepayments) {
    const list = givenByLoan.get(repayment.loan_id) ?? [];
    list.push(repayment);
    givenByLoan.set(repayment.loan_id, list);
  }
  const takenByLoan = new Map<string, typeof takenRepayments>();
  for (const repayment of takenRepayments) {
    const list = takenByLoan.get(repayment.loan_id) ?? [];
    list.push(repayment);
    takenByLoan.set(repayment.loan_id, list);
  }

  const upcoming = [
    ...contactGiven.map((loan) => ({
      id: loan.id,
      kind: "Lending" as const,
      due: loan.expected_repayment_date,
      amount: loan.outstanding,
      currency: loan.currency_code,
      status: loan.status,
    })),
    ...contactTaken.map((loan) => ({
      id: loan.id,
      kind: "Borrowing" as const,
      due: loan.expected_repayment_date,
      amount: loan.outstanding,
      currency: loan.currency_code,
      status: loan.status,
    })),
  ]
    .filter((loan) => loan.due && loan.amount > 0)
    .sort((a, b) => (a.due ?? "").localeCompare(b.due ?? ""));

  const contactSummaries = summaries.filter(
    (summary) => summary.contact_id === contact.id,
  );

  return (
    <div className="space-y-8">
      <header>
        <Link
          href="/admin/finance/contacts"
          className="text-muted-foreground text-sm underline"
        >
          ← Contacts
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          {contact.full_name}
        </h1>
        <p className="text-muted-foreground mt-2">
          {contact.contact_type}
          {contact.phone ? ` · ${contact.phone}` : ""}
          {contact.email ? ` · ${contact.email}` : ""}
          {contact.archived_at ? " · Archived" : ""}
        </p>
        {contact.notes && (
          <p className="text-muted-foreground mt-2 text-sm">{contact.notes}</p>
        )}
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {contactSummaries.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground py-6 text-sm">
              No active lending history for this contact.
            </CardContent>
          </Card>
        ) : (
          contactSummaries.map((summary) => (
            <Card key={summary.currency_code}>
              <CardHeader className="pb-1">
                <CardTitle>{summary.currency_code}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p>
                  Lent:{" "}
                  <strong>
                    {formatMoney(summary.lent_amount, summary.currency_code)}
                  </strong>
                </p>
                <p>
                  Repaid:{" "}
                  <strong>
                    {formatMoney(summary.repaid_amount, summary.currency_code)}
                  </strong>
                </p>
                <p>
                  Outstanding:{" "}
                  <strong>
                    {formatMoney(
                      summary.outstanding_amount,
                      summary.currency_code,
                    )}
                  </strong>
                </p>
                <p>
                  Overdue:{" "}
                  <strong>
                    {formatMoney(summary.overdue_amount, summary.currency_code)}
                  </strong>
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming and overdue repayments</CardTitle>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No open loans with a repayment date.
            </p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Due</TH>
                  <TH>Kind</TH>
                  <TH>Outstanding</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {upcoming.map((loan) => (
                  <TR key={`${loan.kind}-${loan.id}`}>
                    <TD>{loan.due}</TD>
                    <TD>
                      <Badge>{loan.kind}</Badge>
                    </TD>
                    <TD className="tabular-nums">
                      {formatMoney(loan.amount, loan.currency)}
                    </TD>
                    <TD>
                      <Badge
                        className={
                          isOverdue(loan.due, loan.amount, new Date(today))
                            ? "bg-red-500/10 text-red-600"
                            : undefined
                        }
                      >
                        {loan.status}
                      </Badge>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lending history ({contactGiven.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {contactGiven.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No loans given to this contact.
            </p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Given</TH>
                  <TH>Principal</TH>
                  <TH>Repaid</TH>
                  <TH>Outstanding</TH>
                  <TH>Status</TH>
                  <TH>Repayments</TH>
                </TR>
              </THead>
              <TBody>
                {contactGiven.map((loan) => (
                  <TR key={loan.id}>
                    <TD>{loan.date_given}</TD>
                    <TD>{formatMoney(loan.amount, loan.currency_code)}</TD>
                    <TD>
                      {formatMoney(loan.total_repaid, loan.currency_code)}
                    </TD>
                    <TD>{formatMoney(loan.outstanding, loan.currency_code)}</TD>
                    <TD>
                      <Badge>{loan.status}</Badge>
                    </TD>
                    <TD className="text-muted-foreground text-xs">
                      {(givenByLoan.get(loan.id) ?? [])
                        .map(
                          (repayment) =>
                            `${repayment.repayment_date} · ${formatMoney(
                              repayment.amount,
                              loan.currency_code,
                            )}${repayment.cancelled_at ? " (cancelled)" : ""}`,
                        )
                        .join("; ") || "—"}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Borrowing history ({contactTaken.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {contactTaken.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No loans taken from this contact.
            </p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Borrowed</TH>
                  <TH>Principal</TH>
                  <TH>Repaid</TH>
                  <TH>Outstanding</TH>
                  <TH>Status</TH>
                  <TH>Repayments</TH>
                </TR>
              </THead>
              <TBody>
                {contactTaken.map((loan) => (
                  <TR key={loan.id}>
                    <TD>{loan.date_borrowed}</TD>
                    <TD>{formatMoney(loan.amount, loan.currency_code)}</TD>
                    <TD>
                      {formatMoney(loan.total_repaid, loan.currency_code)}
                    </TD>
                    <TD>{formatMoney(loan.outstanding, loan.currency_code)}</TD>
                    <TD>
                      <Badge>{loan.status}</Badge>
                    </TD>
                    <TD className="text-muted-foreground text-xs">
                      {(takenByLoan.get(loan.id) ?? [])
                        .map(
                          (repayment) =>
                            `${repayment.payment_date} · ${formatMoney(
                              repayment.amount,
                              loan.currency_code,
                            )}${repayment.cancelled_at ? " (cancelled)" : ""}`,
                        )
                        .join("; ") || "—"}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

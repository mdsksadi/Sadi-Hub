import type { Metadata } from "next";
import Link from "next/link";
import {
  DonationCorrectionForm,
  DonationCreateForm,
} from "@/components/finance/donation-forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  EmptyRow,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui/table";
import { requireOwner } from "@/lib/auth/owner";
import { getOwnerDonations } from "@/lib/data/donations";
import { recipientTotalsByCurrency } from "@/lib/domain/donations";
import { formatMoney, formatMoneyRange } from "@/lib/domain/money";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Donations",
  robots: { index: false },
};

export default async function AdminDonationsPage() {
  const owner = await requireOwner();
  const { donations, categories, corrections, contacts, accounts } =
    await getOwnerDonations(owner.userId);

  const categoryNames = new Map(
    categories.map((category) => [category.id, category.name]),
  );
  const correctionsByDonation = new Map<string, typeof corrections>();
  for (const correction of corrections) {
    const list = correctionsByDonation.get(correction.donation_id) ?? [];
    list.push(correction);
    correctionsByDonation.set(correction.donation_id, list);
  }

  const currencyTotals = recipientTotalsByCurrency(donations);
  const totalLabel = formatMoneyRange(
    Object.entries(currencyTotals).map(([currency, amount]) => ({
      amount,
      currency,
    })),
  );

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Donations</h1>
        <p className="text-muted-foreground mt-2">
          Total by currency: {totalLabel ?? "No donations recorded yet."}
        </p>
        <Link
          href="/admin/finance/reports"
          className="text-primary mt-2 inline-block text-sm underline"
        >
          Recipient and monthly reports
        </Link>
      </header>

      <DonationCreateForm
        contacts={contacts.filter((contact) => !contact.archived_at)}
        categories={categories}
        accounts={accounts.filter((account) => account.is_active)}
      />

      <Card>
        <CardHeader>
          <CardTitle>Donation history</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Recipient</TH>
                <TH>Category</TH>
                <TH>Amount</TH>
                <TH>Date</TH>
                <TH>Corrections</TH>
              </TR>
            </THead>
            <TBody>
              {donations.length === 0 ? (
                <EmptyRow colSpan={5}>No donations recorded yet.</EmptyRow>
              ) : (
                donations.map((donation) => {
                  const donationCorrections =
                    correctionsByDonation.get(donation.id) ?? [];
                  return (
                    <TR key={donation.id}>
                      <TD>
                        <p className="font-medium">{donation.recipient_name}</p>
                        <p className="text-muted-foreground text-xs">
                          {donation.recipient_type}
                          {donation.purpose ? ` · ${donation.purpose}` : ""}
                        </p>
                      </TD>
                      <TD>
                        {categoryNames.get(donation.category_id ?? "") ?? "—"}
                      </TD>
                      <TD className="tabular-nums">
                        {formatMoney(donation.amount, donation.currency_code)}
                      </TD>
                      <TD>{donation.donation_date}</TD>
                      <TD>
                        {donationCorrections.length === 0 ? (
                          <span className="text-muted-foreground text-xs">
                            None
                          </span>
                        ) : (
                          <ul className="space-y-1 text-xs">
                            {donationCorrections.map((correction) => (
                              <li
                                key={correction.id}
                                className="flex flex-wrap items-center gap-2"
                              >
                                <Badge>{correction.correction_type}</Badge>
                                <Badge
                                  className={
                                    correction.ledger_transaction_id
                                      ? "bg-emerald-500/10 text-emerald-700"
                                      : "bg-amber-500/10 text-amber-700"
                                  }
                                >
                                  {correction.ledger_transaction_id
                                    ? "Ledgered"
                                    : "Pending"}
                                </Badge>
                                <span className="tabular-nums">
                                  {formatMoney(
                                    correction.amount,
                                    donation.currency_code,
                                  )}
                                </span>
                                <span className="text-muted-foreground">
                                  {correction.reason}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                        <DonationCorrectionForm donation={donation} />
                      </TD>
                    </TR>
                  );
                })
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

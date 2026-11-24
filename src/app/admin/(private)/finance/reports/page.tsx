import type { Metadata } from "next";
import { BarChart } from "@/components/ui/bar-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOwner } from "@/lib/auth/owner";
import { getDonationReports } from "@/lib/data/donations";
import {
  monthlyCashflowByCurrency,
  monthlyDonationTotalsByCurrency,
  recipientTotals,
  type RecipientGroup,
} from "@/lib/domain/donations";
import { formatMoney, formatMoneyRange } from "@/lib/domain/money";
import { monthLabel } from "@/lib/domain/finance";
import type { ContactDonationSummary } from "../../../../../../types/supabase";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Finance reports",
  robots: { index: false },
};

function recipientMoney(rows: ContactDonationSummary[]) {
  return rows.map((row) => ({
    amount: row.total_amount,
    currency: row.currency_code.trim(),
  }));
}

export default async function AdminReportsPage() {
  const owner = await requireOwner();
  const report = await getDonationReports(owner.userId);

  const groups = recipientTotals(report.recipients);
  const recipientsByCurrency = new Map<string, RecipientGroup[]>();
  for (const group of groups) {
    const list = recipientsByCurrency.get(group.currency_code) ?? [];
    list.push(group);
    recipientsByCurrency.set(group.currency_code, list);
  }

  const cashflowByCurrency = monthlyCashflowByCurrency(report.cashflow);
  const donationsByCurrency = monthlyDonationTotalsByCurrency(report.donations);
  const currencies = [
    ...new Set([
      ...recipientsByCurrency.keys(),
      ...Object.keys(cashflowByCurrency),
      ...Object.keys(donationsByCurrency),
    ]),
  ].sort();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground mt-2">
          Donations by recipient:{" "}
          {formatMoneyRange(recipientMoney(report.recipients)) ??
            "No donations recorded yet."}
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          Totals are shown one currency at a time. Expense includes donations
          from the ledger; donation trend uses the original gift dates.
        </p>
      </header>

      {currencies.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-8 text-sm">
            No finance data yet. Record an income, expense or donation to see
            trends here.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {currencies.map((currency) => {
            const recipients = recipientsByCurrency.get(currency) ?? [];
            const cashflow = cashflowByCurrency[currency] ?? [];
            const donations = donationsByCurrency[currency] ?? [];

            return (
              <Card key={currency}>
                <CardHeader>
                  <CardTitle>{currency} activity</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h2 className="mb-3 text-sm font-semibold">
                      Donations by recipient
                    </h2>
                    <BarChart
                      rows={recipients.slice(0, 12).map((row) => ({
                        label: row.country_code
                          ? `${row.recipient_name} (${row.country_code})`
                          : row.recipient_name,
                        value: row.total_amount,
                        display: formatMoney(row.total_amount, currency),
                      }))}
                      empty="No donations for this currency."
                    />
                  </div>

                  <div className="grid gap-6 lg:grid-cols-3">
                    <div>
                      <h2 className="mb-3 text-sm font-semibold">Income</h2>
                      <BarChart
                        rows={cashflow.map((row) => ({
                          label: monthLabel(row.month),
                          value: row.income,
                          display: formatMoney(row.income, currency),
                        }))}
                        empty="No income for this currency."
                      />
                    </div>
                    <div>
                      <h2 className="mb-3 text-sm font-semibold">
                        Expense (incl. donations)
                      </h2>
                      <BarChart
                        rows={cashflow.map((row) => ({
                          label: monthLabel(row.month),
                          value: row.expense,
                          display: formatMoney(row.expense, currency),
                        }))}
                        empty="No expense for this currency."
                      />
                    </div>
                    <div>
                      <h2 className="mb-3 text-sm font-semibold">Donations</h2>
                      <BarChart
                        rows={donations.map((row) => ({
                          label: monthLabel(row.month),
                          value: row.total,
                          display: formatMoney(row.total, currency),
                        }))}
                        empty="No donations for this currency."
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

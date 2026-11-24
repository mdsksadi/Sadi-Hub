import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { BarChart } from "@/components/ui/bar-chart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireOwner } from "@/lib/auth/owner";
import { getFinanceOverview } from "@/lib/data/finance";
import {
  monthLabel,
  monthlyTotals,
  totalsByCurrency,
} from "@/lib/domain/finance";
import { formatMoney, formatMoneyRange } from "@/lib/domain/money";
import type { MonthlyCashflow } from "../../../../../types/supabase";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Finance",
  robots: { index: false },
};

export default async function AdminFinancePage() {
  const owner = await requireOwner();
  const { accounts, balances, ledger, cashflow } = await getFinanceOverview(
    owner.userId,
  );
  const accountNames = new Map(
    accounts.map((account) => [account.id, account.name]),
  );
  const totals = totalsByCurrency(
    balances.map((balance) => ({
      currency_code: balance.currency_code,
      amount: balance.balance,
    })),
  );

  const cashflowByReporting = new Map<string, MonthlyCashflow[]>();
  for (const row of cashflow) {
    const group = cashflowByReporting.get(row.reporting_currency) ?? [];
    group.push(row);
    cashflowByReporting.set(row.reporting_currency, group);
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Finance</h1>
        <p className="text-muted-foreground mt-2">
          Cash balances, ledger movements and reporting-currency cashflow.
          Amounts are never added across currencies without a snapshotted rate.
        </p>
      </header>

      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/admin/finance/transactions">Record movement</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/admin/finance/accounts">Accounts</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/admin/finance/transfers">Transfers</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/admin/finance/categories">Categories</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/admin/finance/rates">Exchange rates</Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Cash by currency</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(totals).length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No accounts yet. Add one to start tracking cash.
              </p>
            ) : (
              <div className="space-y-3">
                {Object.entries(totals)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([currency, total]) => (
                    <div
                      key={currency}
                      className="flex items-center justify-between gap-4 rounded-md border px-3 py-2"
                    >
                      <Badge>{currency}</Badge>
                      <span className="font-medium tabular-nums">
                        {formatMoney(total, currency)}
                      </span>
                    </div>
                  ))}
              </div>
            )}
            {balances.length > 0 && (
              <p className="text-muted-foreground mt-4 text-xs">
                Account balances:{" "}
                {formatMoneyRange(
                  balances.map((balance) => ({
                    amount: balance.balance,
                    currency: balance.currency_code,
                  })),
                )}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            {balances.length === 0 ? (
              <p className="text-muted-foreground text-sm">No accounts yet.</p>
            ) : (
              <Table>
                <THead>
                  <tr>
                    <TH>Account</TH>
                    <TH>Currency</TH>
                    <TH className="text-right">Balance</TH>
                  </tr>
                </THead>
                <TBody>
                  {balances.map((balance) => (
                    <TR key={balance.account_id}>
                      <TD className="font-medium">{balance.name}</TD>
                      <TD>{balance.currency_code}</TD>
                      <TD className="text-right tabular-nums">
                        {formatMoney(balance.balance, balance.currency_code)}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent ledger</CardTitle>
        </CardHeader>
        <CardContent>
          {ledger.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No ledger movements recorded yet.
            </p>
          ) : (
            <Table>
              <THead>
                <tr>
                  <TH>Date</TH>
                  <TH>Account</TH>
                  <TH>Type</TH>
                  <TH>Description</TH>
                  <TH className="text-right">Amount</TH>
                </tr>
              </THead>
              <TBody>
                {ledger.map((row) => (
                  <TR key={row.id}>
                    <TD>{row.business_date}</TD>
                    <TD>
                      {accountNames.get(row.account_id) ?? "Unknown account"}
                    </TD>
                    <TD>
                      <Badge>{row.transaction_type}</Badge>
                    </TD>
                    <TD className="text-muted-foreground">
                      {row.description ?? row.notes ?? "—"}
                    </TD>
                    <TD className="text-right tabular-nums">
                      {formatMoney(
                        row.direction * row.amount,
                        row.currency_code,
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {cashflowByReporting.size === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Monthly cashflow</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Income and expense movements will appear here by reporting
                currency.
              </p>
            </CardContent>
          </Card>
        ) : (
          [...cashflowByReporting.entries()].map(([currency, rows]) => {
            const totalsByMonth = monthlyTotals(
              rows,
              (row) => row.month,
              (row) => row.net_reporting,
            );
            return (
              <Card key={currency}>
                <CardHeader className="flex flex-row items-center justify-between gap-3">
                  <CardTitle>Monthly cashflow</CardTitle>
                  <Badge>{currency}</Badge>
                </CardHeader>
                <CardContent>
                  <BarChart
                    rows={totalsByMonth.map((item) => ({
                      label: monthLabel(item.month),
                      value: item.total,
                      display: formatMoney(item.total, currency),
                    }))}
                    empty="No cashflow for this reporting currency yet."
                  />
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

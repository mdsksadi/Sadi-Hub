import type { Metadata } from "next";
import Link from "next/link";
import { DashboardFiltersForm } from "@/components/dashboard/dashboard-filters";
import { Badge } from "@/components/ui/badge";
import { BarChart } from "@/components/ui/bar-chart";
import { Button } from "@/components/ui/button";
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
import {
  getDashboardFilterOptions,
  getDashboardSummary,
  parseDashboardFilters,
} from "@/lib/data/dashboard";
import { formatMoney } from "@/lib/domain/money";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false },
};

type Props = {
  searchParams: Promise<{
    from?: string | string[];
    to?: string | string[];
    country?: string | string[];
    currency?: string | string[];
  }>;
};

function CurrencyAmountList({ amounts }: { amounts: Record<string, number> }) {
  const entries = Object.entries(amounts).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  if (entries.length === 0) {
    return <p className="text-muted-foreground text-sm">Nothing recorded.</p>;
  }
  return (
    <div className="space-y-2">
      {entries.map(([code, value]) => (
        <div
          key={code}
          className="flex items-center justify-between gap-4 rounded-md border px-3 py-2"
        >
          <Badge>{code}</Badge>
          <span className="font-medium tabular-nums">
            {formatMoney(value, code)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default async function AdminDashboardPage({ searchParams }: Props) {
  const owner = await requireOwner();
  const filters = parseDashboardFilters(await searchParams);
  const [summary, options] = await Promise.all([
    getDashboardSummary(owner.userId, filters),
    getDashboardFilterOptions(owner.userId),
  ]);

  const reporting = summary.filters.reportingCurrency;
  const translatedNote = `Translated to ${reporting} using historical rates snapshotted at each transaction or valuation date.`;
  const netWorth = summary.netWorth;
  const breakdown = [
    { label: "Cash", value: netWorth.cash_amount_reporting },
    {
      label: "Property (ESTIMATED)",
      value: netWorth.property_amount_reporting,
    },
    { label: "Receivables", value: netWorth.receivables_amount_reporting },
    { label: "Payables", value: -netWorth.payables_amount_reporting },
  ];
  const countCards = [
    {
      label: "Accounts",
      value: summary.counts.accounts,
      href: "/admin/finance/accounts",
    },
    {
      label: "Contacts",
      value: summary.counts.contacts,
      href: "/admin/finance/contacts",
    },
    {
      label: "Properties",
      value: summary.counts.properties,
      href: "/admin/property",
    },
    {
      label: "Documents",
      value: summary.counts.documents,
      href: "/admin/documents",
    },
    {
      label: "Published posts",
      value: summary.counts.publishedPosts,
      href: "/admin/blog",
    },
  ];
  const donationRows = Object.entries(summary.donationsByCurrency)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, total]) => ({
      label: code,
      value: total,
      display: formatMoney(total, code),
    }));

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Signed in as {owner.displayName} ({owner.email}).
        </p>
        <p className="text-muted-foreground text-xs">
          Reporting currency: {reporting}. Translated figures use snapshotted
          historical rates; original currencies are never summed directly.
        </p>
      </header>

      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/admin/finance">Finance</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/admin/property">Property</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/admin/documents">Documents</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/admin/audit-logs">Audit logs</Link>
        </Button>
      </div>

      <DashboardFiltersForm filters={summary.filters} options={options} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {countCards.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="hover:border-primary h-full transition-colors">
              <CardHeader>
                <CardTitle className="text-muted-foreground text-sm font-medium">
                  {stat.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">{stat.value}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Cash by currency</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <CurrencyAmountList amounts={summary.cashByCurrency} />
            <p className="text-muted-foreground text-xs">
              Balances stay in their original currency. EUR and BDT are never
              added together.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Outstanding loans</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <h2 className="mb-2 text-sm font-semibold">
                Receivables (lent to others)
              </h2>
              <CurrencyAmountList amounts={summary.outstanding.receivable} />
            </div>
            <div>
              <h2 className="mb-2 text-sm font-semibold">
                Payables (borrowed)
              </h2>
              <CurrencyAmountList amounts={summary.outstanding.payable} />
            </div>
            <p className="text-muted-foreground text-xs">
              Amounts are shown separately in the currency each loan was made
              in.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>Cashflow</CardTitle>
            <Badge>{reporting}</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <BarChart
              rows={[
                {
                  label: "Income",
                  value: summary.cashflow.incomeReporting,
                  display: formatMoney(
                    summary.cashflow.incomeReporting,
                    reporting,
                  ),
                },
                {
                  label: "Expense",
                  value: summary.cashflow.expenseReporting,
                  display: formatMoney(
                    summary.cashflow.expenseReporting,
                    reporting,
                  ),
                },
                {
                  label: "Net",
                  value:
                    summary.cashflow.incomeReporting -
                    summary.cashflow.expenseReporting,
                  display: formatMoney(
                    summary.cashflow.incomeReporting -
                      summary.cashflow.expenseReporting,
                    reporting,
                  ),
                },
              ]}
              empty="No cashflow in this range."
            />
            <p className="text-muted-foreground text-xs">{translatedNote}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Donations by currency</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <BarChart rows={donationRows} empty="No donations in this range." />
            <p className="text-muted-foreground text-xs">
              Donation totals stay in the original currency; they are also
              counted as expenses in the translated cashflow above.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Net worth</CardTitle>
          <Badge>
            {reporting} · as of {netWorth.as_of || "today"}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-xs">
            {translatedNote} Property values are ESTIMATED, not verified market
            prices. Net worth = cash + ESTIMATED property + receivables −
            payables.
          </p>

          {netWorth.missing_rate_currencies.length > 0 && (
            <div
              role="alert"
              className="text-danger rounded-md border px-3 py-2 text-sm"
            >
              Missing snapshotted rates for:{" "}
              {netWorth.missing_rate_currencies.join(", ")}. Those components
              were excluded from the translated totals instead of being summed
              across currencies.
            </div>
          )}

          <Table>
            <THead>
              <tr>
                <TH>Component</TH>
                <TH className="text-right">Amount ({reporting})</TH>
              </tr>
            </THead>
            <TBody>
              {breakdown.length === 0 ? (
                <EmptyRow colSpan={2}>No net worth components.</EmptyRow>
              ) : (
                <>
                  {breakdown.map((row) => (
                    <TR key={row.label}>
                      <TD>{row.label}</TD>
                      <TD className="text-right tabular-nums">
                        {formatMoney(row.value, reporting)}
                      </TD>
                    </TR>
                  ))}
                  <TR className="font-semibold">
                    <TD>Net worth</TD>
                    <TD className="text-right tabular-nums">
                      {formatMoney(netWorth.net_amount_reporting, reporting)}
                    </TD>
                  </TR>
                </>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

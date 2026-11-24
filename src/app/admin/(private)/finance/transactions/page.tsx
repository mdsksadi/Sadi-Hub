import type { Metadata } from "next";
import { MovementForm } from "@/components/finance/finance-forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireOwner } from "@/lib/auth/owner";
import {
  getAccounts,
  getFinanceCategories,
  getLedger,
} from "@/lib/data/finance";
import { formatMoney } from "@/lib/domain/money";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Finance · Transactions",
  robots: { index: false },
};

export default async function AdminFinanceTransactionsPage() {
  const owner = await requireOwner();
  const [accounts, categories, ledger] = await Promise.all([
    getAccounts(owner.userId),
    getFinanceCategories(owner.userId),
    getLedger(owner.userId, 100),
  ]);
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const categoryNames = new Map(
    categories.map((category) => [category.id, category.name]),
  );

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
        <p className="text-muted-foreground mt-2">
          Income and expense postings are append-only. Transfers and loan
          principal movements are recorded on their own pages and never count as
          revenue or cost.
        </p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Record income</CardTitle>
          </CardHeader>
          <CardContent>
            <MovementForm
              kind="income"
              accounts={accounts}
              categories={categories}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Record expense</CardTitle>
          </CardHeader>
          <CardContent>
            <MovementForm
              kind="expense"
              accounts={accounts}
              categories={categories}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ledger ({ledger.length})</CardTitle>
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
                  <TH>Category</TH>
                  <TH>Description</TH>
                  <TH className="text-right">Amount</TH>
                </tr>
              </THead>
              <TBody>
                {ledger.map((row) => {
                  const account = accountById.get(row.account_id);
                  return (
                    <TR key={row.id}>
                      <TD>{row.business_date}</TD>
                      <TD>
                        {account?.name ?? "Unknown account"}
                        <span className="text-muted-foreground block text-xs">
                          {row.currency_code}
                        </span>
                      </TD>
                      <TD>
                        <Badge>{row.transaction_type}</Badge>
                      </TD>
                      <TD className="text-muted-foreground">
                        {row.category_id
                          ? (categoryNames.get(row.category_id) ?? "—")
                          : "—"}
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

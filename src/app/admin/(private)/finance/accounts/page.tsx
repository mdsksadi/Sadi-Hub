import type { Metadata } from "next";
import Link from "next/link";
import { AccountForm } from "@/components/finance/finance-forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireOwner } from "@/lib/auth/owner";
import { getAccountBalances, getAccounts } from "@/lib/data/finance";
import { formatMoney } from "@/lib/domain/money";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Finance · Accounts",
  robots: { index: false },
};

export default async function AdminFinanceAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string | string[] }>;
}) {
  const owner = await requireOwner();
  const { edit } = await searchParams;
  const editId = Array.isArray(edit) ? edit[0] : edit;
  const [accounts, balances] = await Promise.all([
    getAccounts(owner.userId),
    getAccountBalances(owner.userId),
  ]);
  const selected = accounts.find((account) => account.id === editId) ?? null;
  const balanceById = new Map(
    balances.map((balance) => [balance.account_id, balance.balance]),
  );

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Accounts</h1>
        <p className="text-muted-foreground mt-2">
          Every account keeps its own currency. Balances combine the opening
          amount with the append-only ledger and are never cross-currency sums.
        </p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{selected ? "Edit account" : "New account"}</CardTitle>
          </CardHeader>
          <CardContent>
            <AccountForm account={selected} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Saved accounts ({accounts.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {accounts.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No accounts yet. Add one with the form.
              </p>
            ) : (
              <Table>
                <THead>
                  <tr>
                    <TH>Name</TH>
                    <TH>Currency</TH>
                    <TH>Opening</TH>
                    <TH className="text-right">Balance</TH>
                    <TH>Status</TH>
                    <TH className="text-right">Action</TH>
                  </tr>
                </THead>
                <TBody>
                  {accounts.map((account) => {
                    const balance =
                      balanceById.get(account.id) ?? account.opening_balance;
                    return (
                      <TR key={account.id}>
                        <TD className="font-medium">
                          {account.name}
                          <span className="text-muted-foreground block text-xs">
                            {account.account_type}
                            {account.country_code
                              ? ` · ${account.country_code}`
                              : ""}
                          </span>
                        </TD>
                        <TD>{account.currency_code}</TD>
                        <TD className="tabular-nums">
                          {formatMoney(
                            account.opening_balance,
                            account.currency_code,
                          )}
                        </TD>
                        <TD className="text-right tabular-nums">
                          {formatMoney(balance, account.currency_code)}
                        </TD>
                        <TD>
                          <Badge
                            className={
                              account.is_active
                                ? "bg-primary/10 text-primary"
                                : "bg-muted text-muted-foreground"
                            }
                          >
                            {account.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TD>
                        <TD className="text-right">
                          <Button asChild variant="outline" size="sm">
                            <Link
                              href={`/admin/finance/accounts?edit=${account.id}`}
                            >
                              Edit
                            </Link>
                          </Button>
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
    </div>
  );
}

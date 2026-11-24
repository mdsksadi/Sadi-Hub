import type { Metadata } from "next";
import { TransferForm } from "@/components/finance/finance-forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireOwner } from "@/lib/auth/owner";
import { getAccounts, getTransfers } from "@/lib/data/finance";
import { formatMoney } from "@/lib/domain/money";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Finance · Transfers",
  robots: { index: false },
};

export default async function AdminFinanceTransfersPage() {
  const owner = await requireOwner();
  const [accounts, transfers] = await Promise.all([
    getAccounts(owner.userId),
    getTransfers(owner.userId, 100),
  ]);
  const accountNames = new Map(
    accounts.map((account) => [account.id, account.name]),
  );

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Transfers</h1>
        <p className="text-muted-foreground mt-2">
          Move cash between accounts. Transfers are cash-neutral: the source
          leg, destination leg and optional fee never appear in income or
          expense totals.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>New transfer</CardTitle>
        </CardHeader>
        <CardContent>
          <TransferForm accounts={accounts} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transfer history ({transfers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {transfers.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No transfers recorded yet.
            </p>
          ) : (
            <Table>
              <THead>
                <tr>
                  <TH>Date</TH>
                  <TH>From → To</TH>
                  <TH className="text-right">Source amount</TH>
                  <TH className="text-right">Destination amount</TH>
                  <TH className="text-right">Rate / fee</TH>
                  <TH>Reference</TH>
                </tr>
              </THead>
              <TBody>
                {transfers.map((transfer) => (
                  <TR key={transfer.id}>
                    <TD>{transfer.transfer_date}</TD>
                    <TD className="font-medium">
                      {accountNames.get(transfer.source_account_id) ??
                        "Unknown account"}
                      <span className="text-muted-foreground"> → </span>
                      {accountNames.get(transfer.destination_account_id) ??
                        "Unknown account"}
                    </TD>
                    <TD className="text-right tabular-nums">
                      {formatMoney(
                        transfer.source_amount,
                        transfer.source_currency,
                      )}
                    </TD>
                    <TD className="text-right tabular-nums">
                      {formatMoney(
                        transfer.destination_amount,
                        transfer.destination_currency,
                      )}
                    </TD>
                    <TD className="text-right tabular-nums">
                      {transfer.exchange_rate.toFixed(8)}
                      <span className="text-muted-foreground block text-xs">
                        fee{" "}
                        {formatMoney(
                          transfer.fee_amount,
                          transfer.source_currency,
                        )}
                      </span>
                    </TD>
                    <TD className="text-muted-foreground">
                      {transfer.reference_number ? (
                        <Badge>{transfer.reference_number}</Badge>
                      ) : (
                        "—"
                      )}
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

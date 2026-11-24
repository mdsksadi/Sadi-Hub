import type { Metadata } from "next";
import { ExchangeRateForm } from "@/components/finance/finance-forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireOwner } from "@/lib/auth/owner";
import { getExchangeRates } from "@/lib/data/finance";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Finance · Exchange rates",
  robots: { index: false },
};

export default async function AdminFinanceRatesPage() {
  await requireOwner();
  const rates = await getExchangeRates();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Exchange rates</h1>
        <p className="text-muted-foreground mt-2">
          Snapshots are effective on and after their date and are immutable.
          Reporting translations use the newest snapshot at or before each
          transaction&apos;s business date — no live FX calls.
        </p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Add snapshot</CardTitle>
          </CardHeader>
          <CardContent>
            <ExchangeRateForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recorded snapshots ({rates.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {rates.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No rates yet. Add EUR → BDT before recording transactions in
                both currencies with consolidated reporting.
              </p>
            ) : (
              <Table>
                <THead>
                  <tr>
                    <TH>Pair</TH>
                    <TH className="text-right">Rate</TH>
                    <TH>Effective</TH>
                    <TH>Source</TH>
                  </tr>
                </THead>
                <TBody>
                  {rates.map((rate) => (
                    <TR key={rate.id}>
                      <TD className="font-medium">
                        <Badge>{rate.from_currency}</Badge>
                        <span className="text-muted-foreground"> → </span>
                        <Badge>{rate.to_currency}</Badge>
                      </TD>
                      <TD className="text-right tabular-nums">
                        {Number(rate.rate).toFixed(8)}
                      </TD>
                      <TD>{rate.effective_date}</TD>
                      <TD className="text-muted-foreground">{rate.source}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

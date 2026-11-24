import type { Metadata } from "next";
import Link from "next/link";
import {
  ContactArchiveToggle,
  ContactForm,
} from "@/components/finance/lending-forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireOwner } from "@/lib/auth/owner";
import { getContactLendingSummaries, getContacts } from "@/lib/data/lending";
import { formatMoney } from "@/lib/domain/money";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Contacts",
  robots: { index: false },
};

type Props = { searchParams: Promise<{ edit?: string }> };

export default async function FinanceContactsPage({ searchParams }: Props) {
  const owner = await requireOwner();
  const { edit } = await searchParams;
  const [contacts, summaries] = await Promise.all([
    getContacts(owner.userId),
    getContactLendingSummaries(owner.userId),
  ]);
  const selected = edit ? (contacts.find((c) => c.id === edit) ?? null) : null;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Contacts</h1>
        <p className="text-muted-foreground mt-2">
          Reusable people and organisations for loans and donations. Lending
          totals stay separated by currency.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>
              Address book{" "}
              <span className="text-muted-foreground text-sm font-normal">
                ({contacts.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {contacts.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No contacts yet. Add one to start recording loans or donations.
              </p>
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Name</TH>
                    <TH>Type</TH>
                    <TH>Contact</TH>
                    <TH>Lending (by currency)</TH>
                    <TH>Actions</TH>
                  </TR>
                </THead>
                <TBody>
                  {contacts.map((contact) => {
                    const rows = summaries.filter(
                      (summary) => summary.contact_id === contact.id,
                    );
                    return (
                      <TR key={contact.id}>
                        <TD className="font-medium">
                          {contact.full_name}
                          {contact.archived_at && (
                            <Badge className="ml-2">Archived</Badge>
                          )}
                        </TD>
                        <TD>{contact.contact_type}</TD>
                        <TD className="text-muted-foreground text-xs">
                          {contact.phone || contact.email || "—"}
                        </TD>
                        <TD className="text-xs">
                          {rows.length === 0 ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <div className="space-y-1">
                              {rows.map((summary) => (
                                <div key={summary.currency_code}>
                                  <span className="font-medium">
                                    {summary.currency_code}
                                  </span>{" "}
                                  · lent{" "}
                                  {formatMoney(
                                    summary.lent_amount,
                                    summary.currency_code,
                                  )}{" "}
                                  · outstanding{" "}
                                  {formatMoney(
                                    summary.outstanding_amount,
                                    summary.currency_code,
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </TD>
                        <TD>
                          <div className="flex flex-wrap items-center gap-1">
                            <Link
                              href={`/admin/finance/contacts/${contact.id}`}
                              className="text-sm underline"
                            >
                              History
                            </Link>
                            <Link
                              href={`/admin/finance/contacts?edit=${contact.id}`}
                              className="text-sm underline"
                            >
                              Edit
                            </Link>
                            <ContactArchiveToggle contact={contact} />
                          </div>
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{selected ? "Edit contact" : "New contact"}</CardTitle>
          </CardHeader>
          <CardContent>
            <ContactForm contact={selected} />
            {selected && (
              <Link
                href="/admin/finance/contacts"
                className="text-muted-foreground mt-4 block text-sm underline"
              >
                Cancel edit
              </Link>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import {
  DocumentRowControls,
  DocumentUploadForm,
  type DocumentOptions,
} from "@/components/documents/document-forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
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
import { getDocuments } from "@/lib/data/documents";
import { getOwnerDonations } from "@/lib/data/donations";
import { getContacts, getLoansGiven, getLoansTaken } from "@/lib/data/lending";
import { getProperties } from "@/lib/data/property";
import { formatMoney } from "@/lib/domain/money";
import { DOCUMENT_CATEGORIES } from "@/lib/validation/property";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Documents",
  robots: { index: false },
};

type Props = {
  searchParams: Promise<{
    category?: string | string[];
    propertyId?: string | string[];
    contactId?: string | string[];
  }>;
};

function first(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" ? raw.trim() : "";
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export default async function AdminDocumentsPage({ searchParams }: Props) {
  const owner = await requireOwner();
  const params = await searchParams;
  const category =
    DOCUMENT_CATEGORIES.find((item) => item === first(params.category)) ?? "";
  const propertyId = first(params.propertyId);
  const contactId = first(params.contactId);

  const [
    documents,
    properties,
    contacts,
    loansGiven,
    loansTaken,
    donationData,
  ] = await Promise.all([
    getDocuments(owner.userId, {
      category: category || null,
      propertyId: isUuid(propertyId) ? propertyId : null,
      contactId: isUuid(contactId) ? contactId : null,
    }),
    getProperties(owner.userId),
    getContacts(owner.userId),
    getLoansGiven(owner.userId),
    getLoansTaken(owner.userId),
    getOwnerDonations(owner.userId),
  ]);

  const options: DocumentOptions = {
    properties: properties.map((property) => ({
      id: property.id,
      label: property.name,
    })),
    contacts: contacts.map((contact) => ({
      id: contact.id,
      label: contact.full_name,
    })),
    loansGiven: loansGiven.map((loan) => ({
      id: loan.id,
      label: `${loan.date_given} · ${formatMoney(loan.amount, loan.currency_code)}`,
    })),
    loansTaken: loansTaken.map((loan) => ({
      id: loan.id,
      label: `${loan.date_borrowed} · ${formatMoney(loan.amount, loan.currency_code)}`,
    })),
    donations: donationData.donations.map((donation) => ({
      id: donation.id,
      label: `${donation.donation_date} · ${donation.recipient_name}`,
    })),
  };
  const propertyNames = new Map(
    options.properties.map((item) => [item.id, item.label]),
  );
  const contactNames = new Map(
    options.contacts.map((item) => [item.id, item.label]),
  );

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Documents</h1>
        <p className="text-muted-foreground mt-2">
          Deeds, khatians, receipts and other records stay in private storage.
          Downloads use short-lived signed links; storage paths are never
          exposed.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Upload a document</CardTitle>
        </CardHeader>
        <CardContent>
          <DocumentUploadForm options={options} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <form method="get" className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="document-filter-category">Category</Label>
              <Select
                id="document-filter-category"
                name="category"
                defaultValue={category}
              >
                <option value="">All categories</option>
                {DOCUMENT_CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {item.replace(/_/g, " ")}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="document-filter-property">Property</Label>
              <Select
                id="document-filter-property"
                name="propertyId"
                defaultValue={propertyId}
              >
                <option value="">All properties</option>
                {options.properties.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="document-filter-contact">Contact</Label>
              <Select
                id="document-filter-contact"
                name="contactId"
                defaultValue={contactId}
              >
                <option value="">All contacts</option>
                {options.contacts.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-end gap-2 sm:col-span-3">
              <Button type="submit" size="sm">
                Apply filters
              </Button>
              <Button type="button" size="sm" variant="outline" asChild>
                <Link href="/admin/documents">Clear</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Documents{" "}
            <span className="text-muted-foreground text-sm font-normal">
              ({documents.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <Table>
              <TBody>
                <EmptyRow colSpan={7}>
                  No documents match these filters.
                </EmptyRow>
              </TBody>
            </Table>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>File</TH>
                  <TH>Category</TH>
                  <TH>Size</TH>
                  <TH>Uploaded</TH>
                  <TH>Related property</TH>
                  <TH>Related contact</TH>
                  <TH>Actions</TH>
                </TR>
              </THead>
              <TBody>
                {documents.map((doc) => (
                  <TR key={doc.id}>
                    <TD>
                      <p className="font-medium">{doc.file_name}</p>
                      {doc.description && (
                        <p className="text-muted-foreground text-xs">
                          {doc.description}
                        </p>
                      )}
                      {doc.tags.length > 0 && (
                        <p className="text-muted-foreground mt-1 text-xs">
                          {doc.tags.join(", ")}
                        </p>
                      )}
                    </TD>
                    <TD>
                      <Badge>{doc.category.replace(/_/g, " ")}</Badge>
                    </TD>
                    <TD className="text-muted-foreground text-xs">
                      {Math.max(1, Math.ceil(doc.size_bytes / 1024))} KiB
                    </TD>
                    <TD className="text-muted-foreground text-xs">
                      {doc.uploaded_at.slice(0, 10)}
                    </TD>
                    <TD className="text-xs">
                      {doc.related_property_id
                        ? (propertyNames.get(doc.related_property_id) ??
                          "Linked")
                        : "—"}
                    </TD>
                    <TD className="text-xs">
                      {doc.related_contact_id
                        ? (contactNames.get(doc.related_contact_id) ?? "Linked")
                        : "—"}
                    </TD>
                    <TD>
                      <DocumentRowControls doc={doc} options={options} />
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

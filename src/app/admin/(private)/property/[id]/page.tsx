import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  OwnershipRosterForm,
  PropertyEditForm,
  UnitConversionForm,
  ValuationForm,
} from "@/components/property/property-forms";
import { BarChart } from "@/components/ui/bar-chart";
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
import { getDocuments } from "@/lib/data/documents";
import {
  getProperty,
  getPropertyOwners,
  getPropertyValuations,
  getUnitConversions,
} from "@/lib/data/property";
import {
  convertArea,
  formatArea,
  formatEstimatedValue,
  sortOwners,
  sortValuationsNewest,
  valuationChartRows,
} from "@/lib/domain/property";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Property details",
  robots: { index: false },
};

type Props = { params: Promise<{ id: string }> };

export default async function PropertyDetailPage({ params }: Props) {
  const { id } = await params;
  const owner = await requireOwner();
  const property = await getProperty(owner.userId, id);
  if (!property) notFound();

  const today = new Date().toISOString().slice(0, 10);
  const [owners, valuations, documents, conversions] = await Promise.all([
    getPropertyOwners(owner.userId, [id]),
    getPropertyValuations(owner.userId, id),
    getDocuments(owner.userId, { propertyId: id }),
    getUnitConversions(),
  ]);
  const roster = sortOwners(owners);
  const history = sortValuationsNewest(valuations);
  const areaConversions = conversions
    .filter(
      (conversion) =>
        conversion.from_unit.trim().toLowerCase() ===
        property.area_unit?.trim().toLowerCase(),
    )
    .map((conversion) => ({
      id: conversion.id,
      toUnit: conversion.to_unit,
      validFrom: conversion.valid_from,
      value: convertArea(
        property.total_area,
        property.area_unit,
        conversion.to_unit,
        conversions,
        today,
      ),
    }))
    .filter((conversion) => conversion.value !== null);

  return (
    <div className="space-y-8">
      <header>
        <Link
          href="/admin/property"
          className="text-muted-foreground text-sm underline"
        >
          ← Property
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          {property.name}
        </h1>
        <p className="text-muted-foreground mt-2">
          {[
            property.village,
            property.union_name,
            property.upazila,
            property.district,
            property.division,
            property.country_code,
          ]
            .filter(Boolean)
            .join(", ") || "No location recorded"}
        </p>
        <p className="mt-1 text-sm">
          Area:{" "}
          <strong>{formatArea(property.total_area, property.area_unit)}</strong>{" "}
          · Current estimate:{" "}
          <strong>
            {formatEstimatedValue(
              property.current_estimated_value,
              property.currency_code,
            )}
          </strong>
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Property details</CardTitle>
        </CardHeader>
        <CardContent>
          <PropertyEditForm property={property} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ownership roster ({roster.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <OwnershipRosterForm propertyId={id} owners={roster} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Valuation history — ESTIMATED</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-muted-foreground text-xs">
            Values are labelled ESTIMATED even when a source has been checked;
            they are not verified market prices.
          </p>
          <BarChart
            rows={valuationChartRows(history)}
            empty="Add a valuation to see the estimated-value trend."
          />
          {history.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No valuations recorded yet.
            </p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Valued on</TH>
                  <TH>Estimated value</TH>
                  <TH>Source</TH>
                  <TH>Status</TH>
                  <TH>Notes</TH>
                </TR>
              </THead>
              <TBody>
                {history.map((valuation) => (
                  <TR key={valuation.id}>
                    <TD>{valuation.valued_on}</TD>
                    <TD className="text-sm">
                      {formatEstimatedValue(
                        valuation.estimated_value,
                        valuation.currency_code,
                      )}
                    </TD>
                    <TD className="text-muted-foreground text-xs">
                      {valuation.source ?? "—"}
                    </TD>
                    <TD>
                      <div className="flex flex-wrap gap-1">
                        <Badge>ESTIMATED</Badge>
                        {valuation.is_verified && (
                          <Badge className="bg-sky-500/10 text-sky-600">
                            Source checked
                          </Badge>
                        )}
                      </div>
                    </TD>
                    <TD className="text-muted-foreground text-xs">
                      {valuation.notes ?? "—"}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
          <div className="rounded-md border p-4">
            <h3 className="mb-3 text-sm font-medium">Add a valuation</h3>
            <ValuationForm
              propertyId={id}
              currency={property.currency_code ?? "BDT"}
              today={today}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Area conversions (advisory)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-3 text-xs">
            Only configured snapshots at or before {today} are used. The
            original unit above is always authoritative.
          </p>
          {areaConversions.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No conversion is configured for this original unit yet.
            </p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>To unit</TH>
                  <TH>Converted area</TH>
                  <TH>Snapshot from</TH>
                </TR>
              </THead>
              <TBody>
                {areaConversions.map((conversion) => (
                  <TR key={conversion.id}>
                    <TD>{conversion.toUnit}</TD>
                    <TD>{formatArea(conversion.value, conversion.toUnit)}</TD>
                    <TD className="text-muted-foreground text-xs">
                      {conversion.validFrom}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
          <UnitConversionForm today={today} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Linked documents ({documents.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <Table>
              <TBody>
                <EmptyRow colSpan={4}>
                  No documents linked to this property.
                </EmptyRow>
              </TBody>
            </Table>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>File</TH>
                  <TH>Category</TH>
                  <TH>Uploaded</TH>
                  <TH>Download</TH>
                </TR>
              </THead>
              <TBody>
                {documents.map((document) => (
                  <TR key={document.id}>
                    <TD>
                      <p className="font-medium">{document.file_name}</p>
                      {document.description && (
                        <p className="text-muted-foreground text-xs">
                          {document.description}
                        </p>
                      )}
                    </TD>
                    <TD>
                      <Badge>{document.category.replace(/_/g, " ")}</Badge>
                    </TD>
                    <TD className="text-muted-foreground text-xs">
                      {document.uploaded_at.slice(0, 10)}
                    </TD>
                    <TD>
                      <a
                        href={`/api/documents/${document.id}`}
                        className="text-primary text-sm underline"
                      >
                        Download
                      </a>
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

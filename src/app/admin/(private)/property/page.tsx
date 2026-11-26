import type { Metadata } from "next";
import Link from "next/link";
import { PropertyCreateForm } from "@/components/property/property-forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireOwner } from "@/lib/auth/owner";
import { getDocuments } from "@/lib/data/documents";
import {
  getProperties,
  getPropertyOwners,
  getPropertyValuations,
  getUnitConversions,
} from "@/lib/data/property";
import {
  formatArea,
  formatEstimatedValue,
  groupBy,
  normalizeOwnerShares,
  sortPropertiesByName,
} from "@/lib/domain/property";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Property",
  robots: { index: false },
};

export default async function AdminPropertyPage() {
  const owner = await requireOwner();
  const today = new Date().toISOString().slice(0, 10);
  const properties = await getProperties(owner.userId);
  const [owners, valuations, documents, conversions] = await Promise.all([
    getPropertyOwners(
      owner.userId,
      properties.map((property) => property.id),
    ),
    getPropertyValuations(owner.userId),
    getDocuments(owner.userId),
    getUnitConversions(),
  ]);

  const ownersByProperty = groupBy(owners, (row) => row.property_id);
  const documentsByProperty = groupBy(
    documents.filter((document) => document.related_property_id),
    (document) => document.related_property_id,
  );
  const byLocation = groupBy(
    properties,
    (property) => property.district ?? property.country_code ?? "Unspecified",
  );
  const sorted = sortPropertiesByName(properties);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Property</h1>
        <p className="text-muted-foreground mt-2">
          Ownership shares must total exactly 100.00. Original land units are
          preserved; values below are estimates, never verified market prices.
        </p>
      </header>

      {byLocation.size > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...byLocation.entries()].map(([location, rows]) => (
            <Card key={location}>
              <CardHeader className="pb-1">
                <CardTitle>{location}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p>
                  Properties: <strong>{rows.length}</strong>
                </p>
                <p>
                  Estates with documents:{" "}
                  <strong>
                    {
                      rows.filter(
                        (property) =>
                          (documentsByProperty.get(property.id)?.length ?? 0) >
                          0,
                      ).length
                    }
                  </strong>
                </p>
                <p className="text-muted-foreground text-xs">
                  Valuations recorded: {valuations.length} · Unit conversions:{" "}
                  {conversions.length}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Add property</CardTitle>
        </CardHeader>
        <CardContent>
          <PropertyCreateForm today={today} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Properties{" "}
            <span className="text-muted-foreground text-sm font-normal">
              ({properties.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sorted.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No properties recorded yet.
            </p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Property</TH>
                  <TH>Location</TH>
                  <TH>Area (original unit)</TH>
                  <TH>Owners</TH>
                  <TH>Current estimate</TH>
                  <TH>Documents</TH>
                  <TH>Details</TH>
                </TR>
              </THead>
              <TBody>
                {sorted.map((property) => {
                  const roster = ownersByProperty.get(property.id) ?? [];
                  const shares = normalizeOwnerShares(
                    roster.map((owner) => ({
                      ownershipPercentage: owner.ownership_percentage,
                    })),
                  );
                  return (
                    <TR key={property.id}>
                      <TD>
                        <p className="font-medium">{property.name}</p>
                        {property.land_classification && (
                          <p className="text-muted-foreground text-xs">
                            {property.land_classification}
                          </p>
                        )}
                      </TD>
                      <TD className="text-muted-foreground text-xs">
                        <div>
                          {[
                            property.village,
                            property.upazila,
                            property.district,
                            property.country_code,
                          ]
                            .filter(Boolean)
                            .join(", ") || "—"}
                        </div>
                        {property.khatian_number && (
                          <div>Khatian {property.khatian_number}</div>
                        )}
                      </TD>
                      <TD>
                        {formatArea(property.total_area, property.area_unit)}
                      </TD>
                      <TD>
                        <Badge>
                          {roster.length} · {shares.total}%
                        </Badge>
                      </TD>
                      <TD className="text-xs">
                        {formatEstimatedValue(
                          property.current_estimated_value,
                          property.currency_code,
                        )}
                      </TD>
                      <TD>
                        {documentsByProperty.get(property.id)?.length ?? 0}
                      </TD>
                      <TD>
                        <Link
                          href={`/admin/property/${property.id}`}
                          className="text-primary text-sm underline"
                        >
                          Open
                        </Link>
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

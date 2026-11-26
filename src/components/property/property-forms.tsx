"use client";

import { useActionState, useState } from "react";
import {
  addUnitConversionAction,
  createPropertyAction,
  recordValuationAction,
  replaceOwnersAction,
  updatePropertyAction,
} from "@/app/admin/(private)/property/actions";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/field";
import {
  formatEstimatedValue,
  normalizeOwnerShares,
} from "@/lib/domain/property";
import type { FormState } from "@/lib/validation/schemas";
import type { Property, PropertyOwnership } from "../../../types/supabase";

const initialState: FormState = { status: "idle" };

function Feedback({ state, pending }: { state: FormState; pending: boolean }) {
  if (state.status === "idle" && !pending) return null;
  if (state.status === "error") {
    return (
      <p role="alert" className="text-danger text-sm">
        {pending ? "Saving…" : state.message}
      </p>
    );
  }
  return (
    <p role="status" className="text-muted-foreground text-sm">
      {pending ? "Saving…" : state.message}
    </p>
  );
}

type OwnerRow = {
  ownerName: string;
  ownershipPercentage: string;
  acquisitionDate: string;
  ownershipType: string;
  notes: string;
};

const emptyOwner = (): OwnerRow => ({
  ownerName: "",
  ownershipPercentage: "",
  acquisitionDate: "",
  ownershipType: "",
  notes: "",
});

function rowsFromOwners(owners: PropertyOwnership[]): OwnerRow[] {
  if (owners.length === 0) return [emptyOwner()];
  return owners.map((owner) => ({
    ownerName: owner.owner_name,
    ownershipPercentage: owner.ownership_percentage.toFixed(2),
    acquisitionDate: owner.acquisition_date?.slice(0, 10) ?? "",
    ownershipType: owner.ownership_type ?? "",
    notes: owner.notes ?? "",
  }));
}

function OwnershipFields({
  idPrefix,
  rows,
  setRows,
}: {
  idPrefix: string;
  rows: OwnerRow[];
  setRows: (rows: OwnerRow[]) => void;
}) {
  const shares = normalizeOwnerShares(rows);
  const update = (index: number, key: keyof OwnerRow, value: string) => {
    setRows(
      rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)),
    );
  };

  return (
    <fieldset className="space-y-3">
      <legend className="text-muted-foreground mb-1 text-sm font-medium">
        Owners
      </legend>
      {rows.map((row, index) => (
        <div
          key={`${idPrefix}-${index}`}
          className="space-y-3 rounded-md border p-3"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor={`${idPrefix}-name-${index}`}>Owner name</Label>
              <Input
                id={`${idPrefix}-name-${index}`}
                name="ownerName"
                required
                maxLength={200}
                value={row.ownerName}
                onChange={(event) =>
                  update(index, "ownerName", event.target.value)
                }
              />
            </div>
            <div>
              <Label htmlFor={`${idPrefix}-share-${index}`}>Share (%)</Label>
              <Input
                id={`${idPrefix}-share-${index}`}
                name="ownershipPercentage"
                inputMode="decimal"
                placeholder="50.00"
                required
                value={row.ownershipPercentage}
                onChange={(event) =>
                  update(index, "ownershipPercentage", event.target.value)
                }
              />
            </div>
            <div>
              <Label htmlFor={`${idPrefix}-date-${index}`}>
                Acquisition date (optional)
              </Label>
              <Input
                id={`${idPrefix}-date-${index}`}
                name="acquisitionDate"
                type="date"
                value={row.acquisitionDate}
                onChange={(event) =>
                  update(index, "acquisitionDate", event.target.value)
                }
              />
            </div>
            <div>
              <Label htmlFor={`${idPrefix}-type-${index}`}>
                Ownership type (optional)
              </Label>
              <Input
                id={`${idPrefix}-type-${index}`}
                name="ownershipType"
                maxLength={80}
                value={row.ownershipType}
                onChange={(event) =>
                  update(index, "ownershipType", event.target.value)
                }
              />
            </div>
          </div>
          <div>
            <Label htmlFor={`${idPrefix}-notes-${index}`}>
              Notes (optional)
            </Label>
            <Textarea
              id={`${idPrefix}-notes-${index}`}
              name="ownerNotes"
              rows={2}
              maxLength={1000}
              value={row.notes}
              onChange={(event) => update(index, "notes", event.target.value)}
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={rows.length <= 1}
            onClick={() => setRows(rows.filter((_, i) => i !== index))}
          >
            Remove {row.ownerName || `owner ${index + 1}`}
            <span className="sr-only"> from the roster</span>
          </Button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={rows.length >= 20}
          onClick={() => setRows([...rows, emptyOwner()])}
        >
          Add owner
        </Button>
        <p
          role="status"
          className={`text-sm ${shares.valid ? "text-emerald-600" : "text-amber-600"}`}
        >
          Ownership total: <strong>{shares.total}</strong> / 100.00
          {!shares.valid && ` — ${shares.message}`}
        </p>
      </div>
    </fieldset>
  );
}

type PropertyDefaults = Pick<
  Property,
  | "name"
  | "area_unit"
  | "country_code"
  | "division"
  | "district"
  | "upazila"
  | "union_name"
  | "village"
  | "mouza"
  | "khatian_number"
  | "dag_number"
  | "land_classification"
  | "total_area"
  | "purchase_date"
  | "purchase_price"
  | "currency_code"
  | "notes"
>;

function PropertyFields({
  defaults,
  today,
}: {
  defaults?: PropertyDefaults;
  today?: string;
}) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="property-name">Property name</Label>
          <Input
            id="property-name"
            name="name"
            required
            maxLength={200}
            defaultValue={defaults?.name ?? ""}
          />
        </div>
        <div>
          <Label htmlFor="property-area-unit">Original area unit</Label>
          <Input
            id="property-area-unit"
            name="areaUnit"
            required
            maxLength={40}
            placeholder="Katha, decimal, m²…"
            defaultValue={defaults?.area_unit ?? ""}
          />
        </div>
        <div>
          <Label htmlFor="property-total-area">Total area</Label>
          <Input
            id="property-total-area"
            name="totalArea"
            inputMode="decimal"
            placeholder="0.0000"
            defaultValue={defaults?.total_area?.toString() ?? ""}
          />
        </div>
        <div>
          <Label htmlFor="property-country">Country code</Label>
          <Input
            id="property-country"
            name="countryCode"
            maxLength={2}
            placeholder="BD"
            defaultValue={defaults?.country_code ?? ""}
          />
        </div>
        <div>
          <Label htmlFor="property-division">Division</Label>
          <Input
            id="property-division"
            name="division"
            maxLength={120}
            defaultValue={defaults?.division ?? ""}
          />
        </div>
        <div>
          <Label htmlFor="property-district">District</Label>
          <Input
            id="property-district"
            name="district"
            maxLength={120}
            defaultValue={defaults?.district ?? ""}
          />
        </div>
        <div>
          <Label htmlFor="property-upazila">Upazila</Label>
          <Input
            id="property-upazila"
            name="upazila"
            maxLength={120}
            defaultValue={defaults?.upazila ?? ""}
          />
        </div>
        <div>
          <Label htmlFor="property-union">Union</Label>
          <Input
            id="property-union"
            name="unionName"
            maxLength={120}
            defaultValue={defaults?.union_name ?? ""}
          />
        </div>
        <div>
          <Label htmlFor="property-village">Village</Label>
          <Input
            id="property-village"
            name="village"
            maxLength={120}
            defaultValue={defaults?.village ?? ""}
          />
        </div>
        <div>
          <Label htmlFor="property-mouza">Mouza</Label>
          <Input
            id="property-mouza"
            name="mouza"
            maxLength={120}
            defaultValue={defaults?.mouza ?? ""}
          />
        </div>
        <div>
          <Label htmlFor="property-khatian">Khatian number</Label>
          <Input
            id="property-khatian"
            name="khatianNumber"
            maxLength={120}
            defaultValue={defaults?.khatian_number ?? ""}
          />
        </div>
        <div>
          <Label htmlFor="property-dag">Dag number</Label>
          <Input
            id="property-dag"
            name="dagNumber"
            maxLength={120}
            defaultValue={defaults?.dag_number ?? ""}
          />
        </div>
        <div>
          <Label htmlFor="property-classification">Land classification</Label>
          <Input
            id="property-classification"
            name="landClassification"
            maxLength={120}
            defaultValue={defaults?.land_classification ?? ""}
          />
        </div>
        <div>
          <Label htmlFor="property-purchase-date">Purchase date</Label>
          <Input
            id="property-purchase-date"
            name="purchaseDate"
            type="date"
            defaultValue={defaults?.purchase_date?.slice(0, 10) ?? today ?? ""}
          />
        </div>
        <div>
          <Label htmlFor="property-purchase-price">Purchase price</Label>
          <Input
            id="property-purchase-price"
            name="purchasePrice"
            inputMode="decimal"
            placeholder="0.00"
            defaultValue={defaults?.purchase_price?.toString() ?? ""}
          />
        </div>
        <div>
          <Label htmlFor="property-currency">Currency code</Label>
          <Input
            id="property-currency"
            name="currencyCode"
            maxLength={3}
            placeholder="BDT"
            defaultValue={defaults?.currency_code ?? ""}
          />
        </div>
      </div>
      <div>
        <Label htmlFor="property-notes">Notes</Label>
        <Textarea
          id="property-notes"
          name="notes"
          rows={3}
          maxLength={2000}
          defaultValue={defaults?.notes ?? ""}
        />
      </div>
    </>
  );
}

export function PropertyCreateForm({ today }: { today: string }) {
  const [state, action, pending] = useActionState(
    createPropertyAction,
    initialState,
  );
  const [rows, setRows] = useState<OwnerRow[]>([emptyOwner()]);
  const shares = normalizeOwnerShares(rows);

  return (
    <form action={action} className="space-y-5">
      <PropertyFields today={today} />
      <OwnershipFields idPrefix="create-owner" rows={rows} setRows={setRows} />
      <Feedback state={state} pending={pending} />
      <Button type="submit" disabled={pending || !shares.valid}>
        Add property
      </Button>
    </form>
  );
}

export function PropertyEditForm({
  property,
}: {
  property: PropertyDefaults & Pick<Property, "id" | "current_estimated_value">;
}) {
  const [state, action, pending] = useActionState(
    updatePropertyAction,
    initialState,
  );

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={property.id} />
      <PropertyFields defaults={property} />
      <p className="text-muted-foreground rounded-md border p-3 text-xs">
        Current estimate:{" "}
        {formatEstimatedValue(
          property.current_estimated_value,
          property.currency_code,
        )}{" "}
        — estimates are append-only. Add a valuation below to change it.
      </p>
      <Feedback state={state} pending={pending} />
      <Button type="submit" disabled={pending}>
        Save property details
      </Button>
    </form>
  );
}

export function OwnershipRosterForm({
  propertyId,
  owners,
}: {
  propertyId: string;
  owners: PropertyOwnership[];
}) {
  const [state, action, pending] = useActionState(
    replaceOwnersAction,
    initialState,
  );
  const [rows, setRows] = useState<OwnerRow[]>(() => rowsFromOwners(owners));
  const shares = normalizeOwnerShares(rows);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="propertyId" value={propertyId} />
      <OwnershipFields idPrefix="roster-owner" rows={rows} setRows={setRows} />
      <p className="text-muted-foreground text-xs">
        Saving replaces the full roster atomically; the shares must still total
        exactly 100.00.
      </p>
      <Feedback state={state} pending={pending} />
      <Button type="submit" disabled={pending || !shares.valid}>
        Save ownership roster
      </Button>
    </form>
  );
}

export function ValuationForm({
  propertyId,
  currency,
  today,
}: {
  propertyId: string;
  currency: string;
  today: string;
}) {
  const [state, action, pending] = useActionState(
    recordValuationAction,
    initialState,
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="propertyId" value={propertyId} />
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="valuation-value">Estimated value</Label>
          <Input
            id="valuation-value"
            name="estimatedValue"
            inputMode="decimal"
            placeholder="0.00"
            required
          />
        </div>
        <div>
          <Label htmlFor="valuation-currency">Currency</Label>
          <Input
            id="valuation-currency"
            name="currencyCode"
            maxLength={3}
            defaultValue={currency}
            required
          />
        </div>
        <div>
          <Label htmlFor="valuation-date">Valued on</Label>
          <Input
            id="valuation-date"
            name="valuedOn"
            type="date"
            defaultValue={today}
            required
          />
        </div>
      </div>
      <div>
        <Label htmlFor="valuation-source">Source (optional)</Label>
        <Input id="valuation-source" name="source" maxLength={120} />
      </div>
      <div>
        <Label htmlFor="valuation-notes">Notes (optional)</Label>
        <Textarea id="valuation-notes" name="notes" rows={2} maxLength={1000} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isVerified" value="true" />
        Source checked (still shown as ESTIMATED, not a market price)
      </label>
      <Feedback state={state} pending={pending} />
      <Button type="submit" disabled={pending}>
        Add valuation
      </Button>
    </form>
  );
}

export function UnitConversionForm({ today }: { today: string }) {
  const [state, action, pending] = useActionState(
    addUnitConversionAction,
    initialState,
  );

  return (
    <details className="mt-3">
      <summary className="text-muted-foreground cursor-pointer text-xs">
        Add a land-unit conversion
      </summary>
      <form action={action} className="mt-3 space-y-3 rounded-md border p-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="conversion-from">From unit</Label>
            <Input
              id="conversion-from"
              name="fromUnit"
              maxLength={40}
              required
            />
          </div>
          <div>
            <Label htmlFor="conversion-to">To unit</Label>
            <Input id="conversion-to" name="toUnit" maxLength={40} required />
          </div>
          <div>
            <Label htmlFor="conversion-factor">Factor</Label>
            <Input
              id="conversion-factor"
              name="factor"
              inputMode="decimal"
              placeholder="1.00000000"
              required
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="conversion-valid">Valid from</Label>
            <Input
              id="conversion-valid"
              name="validFrom"
              type="date"
              defaultValue={today}
              required
            />
          </div>
          <div>
            <Label htmlFor="conversion-source">Source note</Label>
            <Input id="conversion-source" name="sourceNote" maxLength={300} />
          </div>
        </div>
        <p className="text-muted-foreground text-xs">
          No regional factor is assumed; conversions take effect only from their
          stated date.
        </p>
        <Feedback state={state} pending={pending} />
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          Save conversion
        </Button>
      </form>
    </details>
  );
}

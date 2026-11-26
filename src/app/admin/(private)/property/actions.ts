"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth/owner";
import {
  addUnitConversion,
  createProperty,
  recordPropertyValuation,
  replacePropertyOwners,
  updateProperty,
} from "@/lib/services/property";
import { friendlyRpcError } from "@/lib/services/rpc-error";
import {
  formBoolean,
  formOptionalText,
  formText,
} from "@/lib/validation/forms";
import {
  propertyCreateSchema,
  propertyOwnersSchema,
  propertyUpdateSchema,
  propertyValuationSchema,
  unitConversionSchema,
} from "@/lib/validation/property";
import type { FormState } from "@/lib/validation/schemas";

function invalid(message: string, detail?: string): FormState {
  return {
    status: "error",
    message: detail ? `${message}: ${detail}` : message,
  };
}

/** Service errors are already user-safe; anything SQL-shaped is replaced. */
function caught(error: unknown, fallback: string): FormState {
  const raw = error instanceof Error ? error.message : String(error);
  const sqlShaped =
    /relation |column |syntax|SQLSTATE|permission denied|duplicate key|constraint |invalid input syntax/i.test(
      raw,
    );
  return {
    status: "error",
    message: friendlyRpcError(error, sqlShaped ? fallback : raw || fallback),
  };
}

function revalidateProperty(id?: string): void {
  revalidatePath("/admin/property");
  if (id) revalidatePath(`/admin/property/${id}`);
  revalidatePath("/admin/documents");
  revalidatePath("/admin/dashboard");
}

function propertyFields(formData: FormData) {
  return {
    name: formText(formData, "name"),
    areaUnit: formText(formData, "areaUnit"),
    countryCode: formText(formData, "countryCode"),
    division: formOptionalText(formData, "division"),
    district: formOptionalText(formData, "district"),
    upazila: formOptionalText(formData, "upazila"),
    unionName: formOptionalText(formData, "unionName"),
    village: formOptionalText(formData, "village"),
    mouza: formOptionalText(formData, "mouza"),
    khatianNumber: formOptionalText(formData, "khatianNumber"),
    dagNumber: formOptionalText(formData, "dagNumber"),
    landClassification: formOptionalText(formData, "landClassification"),
    totalArea: formText(formData, "totalArea"),
    purchaseDate: formText(formData, "purchaseDate"),
    purchasePrice: formText(formData, "purchasePrice"),
    currencyCode: formText(formData, "currencyCode"),
    currentEstimatedValue: formText(formData, "currentEstimatedValue"),
    notes: formOptionalText(formData, "notes"),
  };
}

function repeated(formData: FormData, key: string): string[] {
  return formData
    .getAll(key)
    .map((value) => (typeof value === "string" ? value.trim() : ""));
}

/** Dynamic owner rows share repeated field names in DOM order. */
function ownersFrom(formData: FormData) {
  const names = repeated(formData, "ownerName");
  const shares = repeated(formData, "ownershipPercentage");
  const dates = repeated(formData, "acquisitionDate");
  const types = repeated(formData, "ownershipType");
  const notes = repeated(formData, "ownerNotes");
  return names.map((ownerName, index) => ({
    ownerName,
    ownershipPercentage: shares[index] ?? "",
    acquisitionDate: dates[index] ?? "",
    ownershipType: types[index] || null,
    notes: notes[index] || null,
  }));
}

export async function createPropertyAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireOwner();
  const parsed = propertyCreateSchema.safeParse({
    ...propertyFields(formData),
    owners: ownersFrom(formData),
  });
  if (!parsed.success) {
    return invalid(
      "Check the property fields",
      parsed.error.issues[0]?.message,
    );
  }

  try {
    await createProperty(parsed.data);
  } catch (error) {
    return caught(error, "Could not create the property.");
  }
  revalidateProperty();
  return { status: "success", message: "Property added." };
}

export async function updatePropertyAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const owner = await requireOwner();
  const parsed = propertyUpdateSchema.safeParse({
    id: formText(formData, "id"),
    ...propertyFields(formData),
  });
  if (!parsed.success) {
    return invalid(
      "Check the property fields",
      parsed.error.issues[0]?.message,
    );
  }

  try {
    await updateProperty(owner.userId, parsed.data);
  } catch (error) {
    return caught(error, "Could not save the property.");
  }
  revalidateProperty(parsed.data.id);
  return { status: "success", message: "Property details saved." };
}

export async function replaceOwnersAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireOwner();
  const propertyId = formText(formData, "propertyId");
  const parsed = propertyOwnersSchema.safeParse({
    propertyId,
    owners: ownersFrom(formData),
  });
  if (!parsed.success) {
    return invalid(
      "Check the ownership roster",
      parsed.error.issues[0]?.message,
    );
  }

  try {
    await replacePropertyOwners(parsed.data);
  } catch (error) {
    return caught(error, "Could not save the ownership roster.");
  }
  revalidateProperty(propertyId);
  return { status: "success", message: "Ownership roster saved." };
}

export async function recordValuationAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireOwner();
  const parsed = propertyValuationSchema.safeParse({
    propertyId: formText(formData, "propertyId"),
    estimatedValue: formText(formData, "estimatedValue"),
    currencyCode: formText(formData, "currencyCode"),
    valuedOn: formText(formData, "valuedOn"),
    source: formOptionalText(formData, "source"),
    isVerified: formBoolean(formData, "isVerified"),
    notes: formOptionalText(formData, "notes"),
  });
  if (!parsed.success) {
    return invalid(
      "Check the valuation fields",
      parsed.error.issues[0]?.message,
    );
  }

  try {
    await recordPropertyValuation(parsed.data);
  } catch (error) {
    return caught(error, "Could not record the valuation.");
  }
  revalidateProperty(parsed.data.propertyId);
  return { status: "success", message: "Estimated value recorded." };
}

export async function addUnitConversionAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireOwner();
  const parsed = unitConversionSchema.safeParse({
    fromUnit: formText(formData, "fromUnit"),
    toUnit: formText(formData, "toUnit"),
    factor: formText(formData, "factor"),
    sourceNote: formOptionalText(formData, "sourceNote"),
    validFrom: formText(formData, "validFrom"),
  });
  if (!parsed.success) {
    return invalid(
      "Check the conversion fields",
      parsed.error.issues[0]?.message,
    );
  }

  try {
    await addUnitConversion(parsed.data);
  } catch (error) {
    return caught(error, "Could not save the unit conversion.");
  }
  revalidateProperty();
  return { status: "success", message: "Unit conversion saved." };
}

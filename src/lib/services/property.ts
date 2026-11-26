import { createClient } from "@/lib/supabase/server";
import type {
  PropertyCreateInput,
  PropertyOwnersInput,
  PropertyUpdateInput,
  PropertyValuationInput,
  UnitConversionInput,
} from "@/lib/validation/property";
import type { Json } from "../../../types/supabase";
import { friendlyRpcError } from "./rpc-error";

/** All writes go through owner-checked RPCs or owner-filtered table updates. */

async function client() {
  const supabase = await createClient(true);
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

function failure(error: unknown, fallback: string): Error {
  const raw = error instanceof Error ? error.message : String(error);
  if (/ownership|share/i.test(raw)) {
    return new Error("Ownership shares must total exactly 100.00.");
  }
  if (/currency is not configured/i.test(raw)) {
    return new Error("That currency is not configured. Add it under Finance.");
  }
  return new Error(friendlyRpcError(error, fallback));
}

function asJson(input: PropertyCreateInput | PropertyOwnersInput): Json {
  return input.owners as unknown as Json;
}

export async function createProperty(
  input: PropertyCreateInput,
): Promise<string> {
  const supabase = await client();
  const { data, error } = await supabase.rpc("create_property", {
    p_name: input.name,
    p_area_unit: input.areaUnit,
    p_country_code: input.countryCode,
    p_division: input.division,
    p_district: input.district,
    p_upazila: input.upazila,
    p_union_name: input.unionName,
    p_village: input.village,
    p_mouza: input.mouza,
    p_khatian_number: input.khatianNumber,
    p_dag_number: input.dagNumber,
    p_land_classification: input.landClassification,
    p_total_area: input.totalArea,
    p_purchase_date: input.purchaseDate,
    p_purchase_price: input.purchasePrice,
    p_currency_code: input.currencyCode,
    p_current_estimated_value: input.currentEstimatedValue,
    p_notes: input.notes,
    p_owners: asJson(input),
  });
  if (error) throw failure(error, "Could not create the property.");
  if (typeof data !== "string") {
    throw new Error("The property was not created. Try again.");
  }
  return data;
}

/** Atomically replaces the whole ownership roster for a property. */
export async function replacePropertyOwners(
  input: PropertyOwnersInput,
): Promise<string> {
  const supabase = await client();
  const { data, error } = await supabase.rpc("add_property_owner", {
    p_property_id: input.propertyId,
    p_owners: asJson(input),
  });
  if (error) throw failure(error, "Could not save the ownership roster.");
  if (typeof data !== "string") {
    throw new Error("The ownership roster was not saved. Try again.");
  }
  return data;
}

export async function recordPropertyValuation(
  input: PropertyValuationInput,
): Promise<string> {
  const supabase = await client();
  const { data, error } = await supabase.rpc("record_property_valuation", {
    p_property_id: input.propertyId,
    p_estimated_value: input.estimatedValue,
    p_currency_code: input.currencyCode,
    p_valued_on: input.valuedOn,
    p_source: input.source,
    p_is_verified: input.isVerified,
    p_notes: input.notes,
  });
  if (error) throw failure(error, "Could not record the valuation.");
  if (typeof data !== "string") {
    throw new Error("The valuation was not recorded. Try again.");
  }
  return data;
}

/** Only descriptive fields are editable: the estimate stays append-only. */
export async function updateProperty(
  ownerId: string,
  input: PropertyUpdateInput,
): Promise<string> {
  const supabase = await client();
  const { data, error } = await supabase
    .from("properties")
    .update({
      name: input.name,
      country_code: input.countryCode,
      division: input.division,
      district: input.district,
      upazila: input.upazila,
      union_name: input.unionName,
      village: input.village,
      mouza: input.mouza,
      khatian_number: input.khatianNumber,
      dag_number: input.dagNumber,
      land_classification: input.landClassification,
      total_area: input.totalArea === null ? null : Number(input.totalArea),
      area_unit: input.areaUnit,
      purchase_date: input.purchaseDate,
      purchase_price:
        input.purchasePrice === null ? null : Number(input.purchasePrice),
      currency_code: input.currencyCode,
      notes: input.notes,
    })
    .eq("id", input.id)
    .eq("owner_id", ownerId)
    .select("id")
    .single();
  if (error) throw failure(error, "Could not save the property.");
  return data.id;
}

/** Configurable land-unit reference data; no universal factor is assumed. */
export async function addUnitConversion(
  input: UnitConversionInput,
): Promise<string> {
  const supabase = await client();
  const { data, error } = await supabase
    .from("unit_conversions")
    .insert({
      from_unit: input.fromUnit,
      to_unit: input.toUnit,
      factor: Number(input.factor),
      source_note: input.sourceNote,
      valid_from: input.validFrom,
    })
    .select("id")
    .single();
  if (error) throw failure(error, "Could not save the unit conversion.");
  return data.id;
}

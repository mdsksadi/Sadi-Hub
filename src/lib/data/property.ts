import { createClient } from "@/lib/supabase/server";
import type {
  Property,
  PropertyOwnership,
  PropertyValuation,
  UnitConversion,
} from "../../../types/supabase";
import { logDataError } from "./log";

/** Read-only, owner-scoped queries. RLS remains the final authorization gate. */

export async function getProperties(ownerId: string): Promise<Property[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("properties")
    .select("*")
    .eq("owner_id", ownerId)
    .order("name", { ascending: true });
  if (error) {
    logDataError("properties", error);
    return [];
  }
  return (data ?? []) as Property[];
}

export async function getProperty(
  ownerId: string,
  id: string,
): Promise<Property | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("properties")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("id", id)
    .maybeSingle();
  if (error) logDataError("property", error);
  return (data ?? null) as Property | null;
}

export async function getPropertyOwners(
  ownerId: string,
  propertyIds: string[] = [],
): Promise<PropertyOwnership[]> {
  if (propertyIds.length === 0) return [];
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("property_ownerships")
    .select("*")
    .eq("owner_id", ownerId)
    .in("property_id", propertyIds)
    .order("owner_name", { ascending: true });
  if (error) {
    logDataError("property_ownerships", error);
    return [];
  }
  return (data ?? []) as PropertyOwnership[];
}

export async function getPropertyValuations(
  ownerId: string,
  propertyId?: string,
): Promise<PropertyValuation[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  let query = supabase
    .from("property_valuations")
    .select("*")
    .eq("owner_id", ownerId);
  if (propertyId) query = query.eq("property_id", propertyId);
  const { data, error } = await query
    .order("valued_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) {
    logDataError("property_valuations", error);
    return [];
  }
  return (data ?? []) as PropertyValuation[];
}

/** unit_conversions is global reference data; RLS restricts reads to owners. */
export async function getUnitConversions(): Promise<UnitConversion[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("unit_conversions")
    .select("*")
    .order("valid_from", { ascending: false })
    .order("from_unit", { ascending: true });
  if (error) {
    logDataError("unit_conversions", error);
    return [];
  }
  return (data ?? []) as UnitConversion[];
}

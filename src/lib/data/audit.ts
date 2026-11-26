import { logDataError } from "@/lib/data/log";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "../../../types/supabase";

export type AuditLog = Database["public"]["Tables"]["audit_logs"]["Row"];

export type AuditLogFilters = {
  tableName?: string | null;
  action?: string | null;
};

/**
 * Append-only, SELECT-only audit rows. RLS limits visibility to the owner;
 * audit_logs has no owner_id column, so no explicit owner filter is possible.
 */
export async function getAuditLogs(
  filters: AuditLogFilters = {},
  limit = 200,
): Promise<AuditLog[]> {
  const supabase = await createClient();
  if (!supabase) return [];

  let query = supabase
    .from("audit_logs")
    .select("*")
    .order("occurred_at", { ascending: false })
    .limit(Math.max(1, Math.min(200, limit)));

  const tableName = filters.tableName?.trim();
  const action = filters.action?.trim();
  if (tableName) query = query.eq("table_name", tableName);
  if (action) query = query.eq("action", action);

  const { data, error } = await query;
  if (error) {
    logDataError("audit_logs", error);
    return [];
  }
  return (data ?? []) as AuditLog[];
}

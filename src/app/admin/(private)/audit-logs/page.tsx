import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/field";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireOwner } from "@/lib/auth/owner";
import { getAuditLogs } from "@/lib/data/audit";
import type { Json } from "../../../../../types/supabase";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Audit logs",
  robots: { index: false },
};

type Props = {
  searchParams: Promise<{
    table?: string | string[];
    table_name?: string | string[];
    action?: string | string[];
  }>;
};

function first(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" ? raw.trim() : "";
}

function formatJson(value: Json | null): string | null {
  if (value === null || value === undefined) return null;
  try {
    const text = JSON.stringify(value, null, 2);
    return text && text !== "{}" && text !== "null" ? text : null;
  } catch {
    return null;
  }
}

function timestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toISOString().slice(0, 19).replace("T", " ")} UTC`;
}

export default async function AuditLogsPage({ searchParams }: Props) {
  await requireOwner();
  const params = await searchParams;
  const tableName = first(params.table) || first(params.table_name);
  const action = first(params.action);
  const logs = await getAuditLogs({ tableName, action }, 100);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Audit logs</h1>
        <p className="text-muted-foreground mt-2">
          Append-only record of changes and business events. Showing the latest
          {logs.length} {logs.length === 1 ? "entry" : "entries"}.
        </p>
        <p className="text-muted-foreground text-xs">
          Logs are read-only: neither the owner nor the application can edit or
          delete them.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <form method="get" className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="audit-table">Table name</Label>
              <Input
                id="audit-table"
                name="table"
                defaultValue={tableName}
                placeholder="donations"
              />
            </div>
            <div>
              <Label htmlFor="audit-action">Action</Label>
              <Input
                id="audit-action"
                name="action"
                defaultValue={action}
                placeholder="create"
              />
            </div>
            <div className="flex items-end gap-2">
              <Button type="submit">Apply</Button>
              {(tableName || action) && (
                <Button asChild variant="outline">
                  <Link href="/admin/audit-logs">Clear</Link>
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No audit entries match these filters.
            </p>
          ) : (
            <Table>
              <THead>
                <tr>
                  <TH>Occurred</TH>
                  <TH>Action</TH>
                  <TH>Table</TH>
                  <TH>Record</TH>
                  <TH>Actor</TH>
                  <TH>Reason</TH>
                  <TH>Changes</TH>
                </tr>
              </THead>
              <TBody>
                {logs.map((log) => (
                  <TR key={log.id}>
                    <TD className="whitespace-nowrap">
                      <time dateTime={log.occurred_at}>
                        {timestamp(log.occurred_at)}
                      </time>
                    </TD>
                    <TD>
                      <Badge>{log.action}</Badge>
                    </TD>
                    <TD>{log.table_name}</TD>
                    <TD className="font-mono text-xs">
                      {log.record_id ?? "—"}
                    </TD>
                    <TD className="font-mono text-xs">
                      {log.actor_id ?? "System"}
                    </TD>
                    <TD className="text-muted-foreground max-w-64">
                      {log.reason ?? "—"}
                    </TD>
                    <TD>
                      <details>
                        <summary className="cursor-pointer text-sm">
                          View JSON
                        </summary>
                        <div className="space-y-3 pt-3">
                          <div>
                            <p className="text-muted-foreground mb-1 text-xs uppercase">
                              Before
                            </p>
                            <pre className="bg-muted max-h-64 overflow-auto rounded-md p-2 text-xs whitespace-pre-wrap">
                              {formatJson(log.old_data) ?? "—"}
                            </pre>
                          </div>
                          <div>
                            <p className="text-muted-foreground mb-1 text-xs uppercase">
                              After
                            </p>
                            <pre className="bg-muted max-h-64 overflow-auto rounded-md p-2 text-xs whitespace-pre-wrap">
                              {formatJson(log.new_data) ?? "—"}
                            </pre>
                          </div>
                        </div>
                      </details>
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

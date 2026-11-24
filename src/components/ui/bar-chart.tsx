import { cn } from "@/lib/utils";

export type BarChartRow = {
  label: string;
  value: number;
  display?: string;
};

/** Server-rendered chart: no client-side chart library in the Worker bundle. */
export function BarChart({
  rows,
  empty = "No data yet.",
  className,
}: {
  rows: BarChartRow[];
  empty?: string;
  className?: string;
}) {
  if (rows.length === 0) {
    return <p className="text-muted-foreground text-sm">{empty}</p>;
  }

  const max = Math.max(...rows.map((row) => Math.abs(row.value)), 1);

  return (
    <div className={cn("space-y-3", className)} aria-label="Bar chart">
      {rows.map((row) => (
        <div
          key={row.label}
          className="grid grid-cols-[7rem_1fr_auto] items-center gap-3 text-sm"
        >
          <span className="text-muted-foreground truncate">{row.label}</span>
          <div className="bg-muted h-2 overflow-hidden rounded-full">
            <div
              className="bg-primary h-full rounded-full"
              style={{
                width: `${Math.max(2, (Math.abs(row.value) / max) * 100)}%`,
              }}
            />
          </div>
          <span className="tabular-nums">
            {row.display ?? row.value.toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  );
}

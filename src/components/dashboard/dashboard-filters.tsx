import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import type {
  DashboardFilterOptions,
  DashboardFilters,
} from "@/lib/data/dashboard";

/** Plain GET form: no Server Action, no client JavaScript. */
export function DashboardFiltersForm({
  filters,
  options,
}: {
  filters: DashboardFilters;
  options: DashboardFilterOptions;
}) {
  const hasFilters = Boolean(
    filters.from || filters.to || filters.countryCode || filters.currencyCode,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Filters</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          method="get"
          action="/admin/dashboard"
          className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-5"
        >
          <div>
            <Label htmlFor="dashboard-from">From</Label>
            <Input
              id="dashboard-from"
              name="from"
              type="date"
              defaultValue={filters.from ?? ""}
            />
          </div>
          <div>
            <Label htmlFor="dashboard-to">To</Label>
            <Input
              id="dashboard-to"
              name="to"
              type="date"
              defaultValue={filters.to ?? ""}
            />
          </div>
          <div>
            <Label htmlFor="dashboard-country">Country</Label>
            <Select
              id="dashboard-country"
              name="country"
              defaultValue={filters.countryCode ?? ""}
            >
              <option value="">All countries</option>
              {filters.countryCode &&
                !options.countries.includes(filters.countryCode) && (
                  <option value={filters.countryCode}>
                    {filters.countryCode}
                  </option>
                )}
              {options.countries.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="dashboard-currency">Currency</Label>
            <Select
              id="dashboard-currency"
              name="currency"
              defaultValue={filters.currencyCode ?? ""}
            >
              <option value="">All currencies</option>
              {filters.currencyCode &&
                !options.currencies.some(
                  (item) => item.code === filters.currencyCode,
                ) && (
                  <option value={filters.currencyCode}>
                    {filters.currencyCode}
                  </option>
                )}
              {options.currencies.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name ? `${item.code} — ${item.name}` : item.code}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex gap-2">
            <Button type="submit">Apply</Button>
            {hasFilters && (
              <Button asChild variant="outline">
                <Link href="/admin/dashboard">Clear</Link>
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

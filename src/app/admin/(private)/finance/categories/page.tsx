import type { Metadata } from "next";
import Link from "next/link";
import { FinanceCategoryForm } from "@/components/finance/finance-forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireOwner } from "@/lib/auth/owner";
import { getFinanceCategories } from "@/lib/data/finance";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Finance · Categories",
  robots: { index: false },
};

export default async function AdminFinanceCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string | string[] }>;
}) {
  const owner = await requireOwner();
  const { edit } = await searchParams;
  const editId = Array.isArray(edit) ? edit[0] : edit;
  const categories = await getFinanceCategories(owner.userId);
  const selected =
    categories.find((category) => category.id === editId) ?? null;
  const names = new Map(
    categories.map((category) => [category.id, category.name]),
  );

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Categories</h1>
        <p className="text-muted-foreground mt-2">
          Classify income and expenses. Transfers and loan principal movements
          are deliberately not categories.
        </p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{selected ? "Edit category" : "New category"}</CardTitle>
          </CardHeader>
          <CardContent>
            <FinanceCategoryForm category={selected} categories={categories} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Saved categories ({categories.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {categories.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No categories yet. Seed defaults are added by the finance
                migration for existing owners.
              </p>
            ) : (
              <Table>
                <THead>
                  <tr>
                    <TH>Name</TH>
                    <TH>Kind</TH>
                    <TH>Parent</TH>
                    <TH>Status</TH>
                    <TH className="text-right">Action</TH>
                  </tr>
                </THead>
                <TBody>
                  {categories.map((category) => (
                    <TR key={category.id}>
                      <TD className="font-medium">
                        {category.name}
                        {category.icon && (
                          <span className="text-muted-foreground block text-xs">
                            {category.icon}
                          </span>
                        )}
                      </TD>
                      <TD>
                        <Badge>{category.kind}</Badge>
                      </TD>
                      <TD className="text-muted-foreground">
                        {category.parent_id
                          ? (names.get(category.parent_id) ?? "—")
                          : "—"}
                      </TD>
                      <TD>
                        <Badge
                          className={
                            category.is_active
                              ? "bg-primary/10 text-primary"
                              : "bg-muted text-muted-foreground"
                          }
                        >
                          {category.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TD>
                      <TD className="text-right">
                        <Button asChild variant="outline" size="sm">
                          <Link
                            href={`/admin/finance/categories?edit=${category.id}`}
                          >
                            Edit
                          </Link>
                        </Button>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

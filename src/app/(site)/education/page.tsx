import type { Metadata } from "next";
import { Markdown } from "@/components/markdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPublicEducation } from "@/lib/data/portfolio";
import { formatDateRange } from "@/lib/utils";

export const revalidate = 300;
export const metadata: Metadata = { title: "Education" };

export default async function EducationPage() {
  const items = await getPublicEducation();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Education</h1>
        <p className="text-muted-foreground mt-2">Academic background.</p>
      </header>

      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No education published yet.
        </p>
      ) : (
        <div className="grid gap-4">
          {items.map((item) => (
            <Card key={item.id}>
              <CardHeader>
                <CardTitle>
                  {item.degree}
                  {item.field_of_study ? ` in ${item.field_of_study}` : ""}
                </CardTitle>
                <p className="text-muted-foreground text-sm">
                  {item.institution}
                </p>
                <p className="text-muted-foreground text-xs">
                  {formatDateRange(item.start_date, item.end_date)}
                </p>
              </CardHeader>
              {item.description_md && (
                <CardContent>
                  <Markdown source={item.description_md} />
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
